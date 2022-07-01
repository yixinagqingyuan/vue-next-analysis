import { ErrorCodes, callWithErrorHandling } from './errorHandling'
import { isArray, NOOP } from '@vue/shared'
import { ComponentInternalInstance, getComponentName } from './component'
import { warn } from './warning'

export interface SchedulerJob extends Function {
  id?: number
  active?: boolean
  computed?: boolean
  /**
   * Indicates whether the effect is allowed to recursively trigger itself
   * when managed by the scheduler.
   *
   * By default, a job cannot trigger itself because some built-in method calls,
   * e.g. Array.prototype.push actually performs reads as well (#1740) which
   * can lead to confusing infinite loops.
   * The allowed cases are component update functions and watch callbacks.
   * Component update functions may update child component props, which in turn
   * trigger flush: "pre" watch callbacks that mutates state that the parent
   * relies on (#1801). Watch callbacks doesn't track its dependencies so if it
   * triggers itself again, it's likely intentional and it is the user's
   * responsibility to perform recursive state mutation that eventually
   * stabilizes (#1727).
   */
  allowRecurse?: boolean
  /**
   * Attached by renderer.ts when setting up a component's render effect
   * Used to obtain component information when reporting max recursive updates.
   * dev only.
   */
  ownerInstance?: ComponentInternalInstance
}

export type SchedulerJobs = SchedulerJob | SchedulerJob[]

let isFlushing = false
let isFlushPending = false

const queue: SchedulerJob[] = []
let flushIndex = 0

const pendingPreFlushCbs: SchedulerJob[] = []
let activePreFlushCbs: SchedulerJob[] | null = null
let preFlushIndex = 0

const pendingPostFlushCbs: SchedulerJob[] = []
let activePostFlushCbs: SchedulerJob[] | null = null
let postFlushIndex = 0

const resolvedPromise: Promise<any> = Promise.resolve()
let currentFlushPromise: Promise<void> | null = null

let currentPreFlushParentJob: SchedulerJob | null = null

const RECURSION_LIMIT = 100
type CountMap = Map<SchedulerJob, number>

export function nextTick<T = void>(
  this: T,
  fn?: (this: T) => void
): Promise<void> {
  const p = currentFlushPromise || resolvedPromise
  return fn ? p.then(this ? fn.bind(this) : fn) : p
}

// #2768
// Use binary-search to find a suitable position in the queue,
// so that the queue maintZains the increasing order of job's id,
// which can prevent the job from being skipped and also can avoid repeated patching.
//使用二进制搜索在队列中找到合适的位置，
//这样队列将保持作业id的递增顺序，
//这可以防止作业被跳过，也可以避免重复修补。
function findInsertionIndex(id: number) {
  // the start index should be `flushIndex + 1`
  let start = flushIndex + 1
  let end = queue.length

  while (start < end) {
    const middle = (start + end) >>> 1
    const middleJobId = getId(queue[middle])
    middleJobId < id ? (start = middle + 1) : (end = middle)
  }

  return start
}
//接收一个函数作为参数，会将函数按顺序保存到一个队列中，它是一个微任务
export function queueJob(job: SchedulerJob) {
  // the dedupe search uses the startIndex argument of Array.includes()
  // by default the search index includes the current job that is being run
  // so it cannot recursively trigger itself again.
  // if the job is a watch() callback, the search will start with a +1 index to
  // allow it recursively trigger itself - it is the user's responsibility to
  // ensure it doesn't end up in an infinite loop.
  //重复数据消除搜索使用数组的startIndex参数。包括（）
  //默认情况下，搜索索引包括正在运行的当前作业
  //因此，它不能再次递归触发自身。
  //如果作业是watch（）回调，则搜索将以+1索引开始，以
  //允许它递归地触发自己——这是用户的责任
  //确保它不会以无限循环结束。
  // 如果有了就不插入任务队列
  if (
    (!queue.length ||
      !queue.includes(
        job,
        isFlushing && job.allowRecurse ? flushIndex + 1 : flushIndex
      )) &&
    job !== currentPreFlushParentJob
  ) {
    if (job.id == null) {
      queue.push(job)
    } else {
      queue.splice(findInsertionIndex(job.id), 0, job)
    }
    queueFlush()
  }
}
// 冲刷队列
function queueFlush() {
  // 如果没有正在刷新的 && 正在等待刷新的
  // 则执行 flushJobs
  if (!isFlushing && !isFlushPending) {
    // 正在等待刷新
    isFlushPending = true
    // 启动微任务，开始刷新任务队列。
    // flushJobs执行结束 将promise赋值给 currentFlushPromise
    currentFlushPromise = resolvedPromise.then(flushJobs)
  }
}

export function invalidateJob(job: SchedulerJob) {
  const i = queue.indexOf(job)
  if (i > flushIndex) {
    queue.splice(i, 1)
  }
}
//queueCb 和queueJob 的区别就是多了几个参数并且他还可以传数组，但是他们的本质都是异步任务
// pendingQueue就是传入的在dom更新前以及跟新后的的队列数组
function queueCb(
  cb: SchedulerJobs,
  activeQueue: SchedulerJob[] | null,
  pendingQueue: SchedulerJob[],
  index: number
) {
  if (!isArray(cb)) {
    if (
      !activeQueue ||
      !activeQueue.includes(cb, cb.allowRecurse ? index + 1 : index)
    ) {
      pendingQueue.push(cb)
    }
  } else {
    // if cb is an array, it is a component lifecycle hook which can only be
    // triggered by a job, which is already deduped in the main queue, so
    // we can skip duplicate check here to improve perf
    pendingQueue.push(...cb)
  }
  queueFlush()
}
// queuePreFlushCb 和queuePostFlushCb 的却别是在维护dom更新前和更新后的区别
export function queuePreFlushCb(cb: SchedulerJob) {
  queueCb(cb, activePreFlushCbs, pendingPreFlushCbs, preFlushIndex)
}

export function queuePostFlushCb(cb: SchedulerJobs) {
  queueCb(cb, activePostFlushCbs, pendingPostFlushCbs, postFlushIndex)
}

export function flushPreFlushCbs(
  seen?: CountMap,
  parentJob: SchedulerJob | null = null
) {
  if (pendingPreFlushCbs.length) {  
    currentPreFlushParentJob = parentJob
    // 👉 去重
    activePreFlushCbs = [...new Set(pendingPreFlushCbs)]
    // 👉  置预刷jobs array 为空
    pendingPreFlushCbs.length = 0
    if (__DEV__) {
      seen = seen || new Map()
    }
    for (
      preFlushIndex = 0;
      preFlushIndex < activePreFlushCbs.length;
      preFlushIndex++
    ) {
      if (
        __DEV__ &&
        checkRecursiveUpdates(seen!, activePreFlushCbs[preFlushIndex])
      ) {
        // 递归刷新检查
        continue
      }
      // 👉 执行job eg: watch job
      // 👉 watch 会在这里执行
      activePreFlushCbs[preFlushIndex]()
    }
    // 👉 重置
    activePreFlushCbs = null
    preFlushIndex = 0
    currentPreFlushParentJob = null
    // recursively flush until it drains
    // 👉 递归刷新预刷新jobs
    flushPreFlushCbs(seen, parentJob)
  }
}

export function flushPostFlushCbs(seen?: CountMap) {
  // 👉 如果存在后置刷新任务
  if (pendingPostFlushCbs.length) {
    // 👉 去重job
    const deduped = [...new Set(pendingPostFlushCbs)]
    // 👉 正在等待的任务池 情况
    pendingPostFlushCbs.length = 0

    // #1947 already has active queue, nested flushPostFlushCbs call
    if (activePostFlushCbs) {
      // 👉 如果已经有活跃的队列，嵌套的flushPostFlushCbs调用
      activePostFlushCbs.push(...deduped)
      return
    }
    // 👉 将等待的作为当前的任务
    activePostFlushCbs = deduped
    if (__DEV__) {
      seen = seen || new Map()
    }
    // 👉 对后置任务进行排序
    activePostFlushCbs.sort((a, b) => getId(a) - getId(b))

    for (
      postFlushIndex = 0;
      postFlushIndex < activePostFlushCbs.length;
      postFlushIndex++
    ) {
      if (
        __DEV__ &&
        checkRecursiveUpdates(seen!, activePostFlushCbs[postFlushIndex])
      ) {
        continue
      }

      //👉  执行后置任务
      activePostFlushCbs[postFlushIndex]()
    }
    // 👉 重置正在执行的任务池
    activePostFlushCbs = null
    postFlushIndex = 0
  }
}

const getId = (job: SchedulerJob): number =>
  job.id == null ? Infinity : job.id


function flushJobs(seen?: CountMap) {
  // 👉 等待刷新结束，开始刷新
  isFlushPending = false
  isFlushing = true
  if (__DEV__) {
    seen = seen || new Map()
  }
  // 👉 前置刷新开始 jobs
  // 为watch量身定做是，主要就是异步执行watch，以及watcheffect等内容的依赖
  flushPreFlushCbs(seen)
  // 👉 前置刷新结束
  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child so its render effect will have smaller
  //    priority number)
  // 2. If a component is unmounted during a parent component's update,
  //    its update can be skipped.
  // 👉 在刷新前对队列排序
  // 1. 保证组件更新顺序是从父组件到子组件（因为父组件总是在子组件之前创建，所以其渲染副作用的优先级将更小）
  // 2.如果一个子组件在父组件更新期间卸载了，可以跳过该子组件的更新。
  queue.sort((a, b) => getId(a) - getId(b))

  // conditional usage of checkRecursiveUpdate must be determined out of
  // try ... catch block since Rollup by default de-optimizes treeshaking
  // inside try-catch. This can leave all warning code unshaked. Although
  // they would get eventually shaken by a minifier like terser, some minifiers
  // would fail to do that (e.g. https://github.com/evanw/esbuild/issues/1610)
  const check = __DEV__
    ? (job: SchedulerJob) => checkRecursiveUpdates(seen!, job)
    : NOOP

  try {
    for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
      const job = queue[flushIndex]
      if (job && job.active !== false) {
        if (__DEV__ && check(job)) {
          continue
        }
        // console.log(`running:`, job.id)
        // 执行 job 函数
        callWithErrorHandling(job, null, ErrorCodes.SCHEDULER)
      }
    }
  } finally {
    // 👉 重置正在刷新队列
    flushIndex = 0
    queue.length = 0
    // 👉 刷新后置刷新jobs
    flushPostFlushCbs(seen)
    // 👉 刷新结束
    isFlushing = false
    currentFlushPromise = null
    // some postFlushCb queued jobs!
    // keep flushing until it drains.
    // 👉 如果还有当前任务或者，等待的预算新任务，或者等待的后刷新任务，则递归刷新

    if (
      queue.length ||
      pendingPreFlushCbs.length ||
      pendingPostFlushCbs.length
    ) {
      // 递归刷新
      flushJobs(seen)
    }
  }
}

function checkRecursiveUpdates(seen: CountMap, fn: SchedulerJob) {
  if (!seen.has(fn)) {
    seen.set(fn, 1)
  } else {
    const count = seen.get(fn)!
    if (count > RECURSION_LIMIT) {
      const instance = fn.ownerInstance
      const componentName = instance && getComponentName(instance.type)
      warn(
        `Maximum recursive updates exceeded${componentName ? ` in component <${componentName}>` : ``
        }. ` +
        `This means you have a reactive effect that is mutating its own ` +
        `dependencies and thus recursively triggering itself. Possible sources ` +
        `include component template, render function, updated hook or ` +
        `watcher source function.`
      )
      return true
    } else {
      seen.set(fn, count + 1)
    }
  }
}
