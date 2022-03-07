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
// 如果大于0 的情况，表示 dep.n或者dep.w和trackopbit 的位数重了,否则就是位数没重，位数重了表示
//判断是否以前被收集过
export const wasTracked = (dep: Dep): boolean => (dep.w & trackOpBit) > 0// 如果任意一个位是0 则结果就是0。
//判断是否是重新收集
export const newTracked = (dep: Dep): boolean => (dep.n & trackOpBit) > 0 // 如果任意一个位是0 则结果就是0。

export const initDepMarkers = ({ deps }: ReactiveEffect) => {
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      // 组件更新的时候重新给已经收集的组件打标签，后期用来判断是不是已经被收集过了
      deps[i].w |= trackOpBit // set was tracked 标记依赖已经被收集
    }
  }
}
// 当前方法是为了去除多余依赖，防止触发不必要的依赖更新
// 只保证跟当前变量有关的内容更新
export const finalizeDepMarkers = (effect: ReactiveEffect) => {
  // 拿到当前effect中的deps
  const { deps } = effect
  // 如果有deps，那么就说明需要动deps 中的dep 了
  if (deps.length) {
    // 先声明个ptr 就是为了清除多余的不需要被关联的effect
    let ptr = 0
    for (let i = 0; i < deps.length; i++) {
      const dep = deps[i]
      if (wasTracked(dep) && !newTracked(dep)) {
        // 当前这个删除由于是引用类型，导致我删除当前的内容，会影响的ref.dep 中的依赖
        // 从而到达到更新ref.dep中的依赖
        // 曾经被收集过但不是新的依赖，需要删除
        dep.delete(effect)
      } else {
        deps[ptr++] = dep
      }
      // clear bits
      // 清空状态
      //~ 表示按位非
      //const a = 5;     // 00000000000000000000000000000101
      //console.log(~a); // 11111111111111111111111111111010
      //只会清除当前位
      dep.w &= ~trackOpBit
      dep.n &= ~trackOpBit
    }
    deps.length = ptr
  }
}
