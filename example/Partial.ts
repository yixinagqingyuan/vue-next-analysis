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

