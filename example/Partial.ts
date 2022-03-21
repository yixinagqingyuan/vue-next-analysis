interface dom {
    a: number,
    b: number,
    c: number
}
function a(type): dom {
    if (type === 1) {
        return {
            a: 1,
            b: 2,
            c: 3
        }
    } else {
        return null
    }
}
//Partial 作用是将传入的属性变为可选项
const b: Partial<dom> = a(2) || {}
b.a = 1

interface vnode {
    a: string
    b: number
}
interface vnode1 {
    a: number
    c: number
}
// const c: vnode | vnode1 = {
//     c: 1
// }
function d(f: vnode | vnode1) {
    if ('c' in f) {
        return f.c
    }
}

interface Rectangle {
    type: number,
    width: number,
}

interface Circle {
    type: number,
    radius: number
}

// 类型断言
// 联合类型
function area(shape: Rectangle | Circle) {
    if ('width' in shape) {
        return shape.width
    } else {
        return shape.radius
    }
}

function abc(b: string | number) {
    b = 1
}

function fn<T, M>(a: M): M {
    return a
}
fn<number, string>('1')

var ab: number = 1
a.toString

function createArray<T>(length: T): T {
    return length
}

createArray(1); // ['x', 'x', 'x']


function arrToObj<
    T extends Record<L | V, unknown>,
    L extends string,
    V extends string,
    >(arr: T[], label: L, value: V): Record<string, T[L]>
function arrToObj<T extends Record<L | 'value', unknown>, L extends string>(
    arr: T[],
    label: L,
): Record<string, T[L | 'value']>
function arrToObj<T extends Record<'label' | 'value', unknown>>(
    arr: T[],
): Record<string, T['label' | 'value']>
function arrToObj(
    arr: Record<string, unknown>[],
    label = 'label',
    value = 'value',
) {
    return arr as any
}
arrToObj([{ aaa: 's', value: "1" }], 'aaa')

// const ab: Record<number, string> = {
//     1: '1'

// }

// // type studentScore = { [name: string]: number }
// type studentScore = Record<string, number>
// const aaa: studentScore = {
//     a: 1
// }