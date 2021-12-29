import { a } from './runtime'
// 测试发现当前声明能够对引入的模块做内容内容添加，从而解决外部拓展内部没有导致类型校验报错的问题
declare module './runtime' {
    export interface a {
        b: string
    }
}
// const b: a = {
//     a: 'aaa',
//     b: 'aaa'
// }