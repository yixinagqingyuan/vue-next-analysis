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
const b: Partial<dom> = a(2) || {}
b.a = 1
