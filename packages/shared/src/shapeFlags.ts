
// 本身在设计之初俺觉得每一个类型都是由1左移得到
// 1 10 1000 10000 100000   ...
// 他们每个地方差一个位置所以去做运算的时候，如果在当前位置没有值，那么他是不可能返回大于1的数的 
// 所以 COMPONENT这个类型，|他就会包含 他由于是相同为0 那么他就会占满当前的二进制位是，所以再去&的时候，
//也只有，之前合并的有这个资格，如此一来就能达到目的


export const enum ShapeFlags {
  ELEMENT = 1,
  FUNCTIONAL_COMPONENT = 1 << 1,//2
  STATEFUL_COMPONENT = 1 << 2,//4
  TEXT_CHILDREN = 1 << 3,//8
  ARRAY_CHILDREN = 1 << 4,//16
  SLOTS_CHILDREN = 1 << 5,//32
  TELEPORT = 1 << 6,//64
  SUSPENSE = 1 << 7,//128
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8,//256
  COMPONENT_KEPT_ALIVE = 1 << 9,//512
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT // 6
}
