import { ReactiveEffect, trackOpBit } from './effect'

export type Dep = Set<ReactiveEffect> & TrackedMarkers

/**
 * wasTracked and newTracked maintain the status for several levels of effect
 * tracking recursion. One bit per level is used to define whether the dependency
 * was/is tracked.
 */
type TrackedMarkers = {
  /**
   * wasTracked
   */
  w: number
  /**
   * newTracked
   */
  n: number
}

export const createDep = (effects?: ReactiveEffect[]): Dep => {
  const dep = new Set<ReactiveEffect>(effects) as Dep
  //w 表示是否已经被收集，n 表示是否新收集。
  // 这个过程牵涉到大量对 Set 集合的添加和删除操作。在许多场景下，依赖关系是很少改变的，因此这里存在一定的优化空间。
  dep.w = 0
  dep.n = 0
  return dep
}

export const wasTracked = (dep: Dep): boolean => (dep.w & trackOpBit) > 0

export const newTracked = (dep: Dep): boolean => (dep.n & trackOpBit) > 0

export const initDepMarkers = ({ deps }: ReactiveEffect) => {
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].w |= trackOpBit // set was tracked 标记依赖已经被收集
    }
  }
}
// 当前方法是为了去除多余依赖，防止触发不必要的依赖更新
// 只保证跟当前变量有关的内容更新
export const finalizeDepMarkers = (effect: ReactiveEffect) => {
  const { deps } = effect
  if (deps.length) {
    let ptr = 0
    for (let i = 0; i < deps.length; i++) {
      const dep = deps[i]
      if (wasTracked(dep) && !newTracked(dep)) {
        // 当前这个删除由于是引用类型，导致我删除当前的内容，会影响的ref.dep 中的依赖
        // 从而到达到更新ref.dep中的依赖
        dep.delete(effect)
      } else {
        deps[ptr++] = dep
      }
      // clear bits
      dep.w &= ~trackOpBit
      dep.n &= ~trackOpBit
    }
    deps.length = ptr
  }
}
