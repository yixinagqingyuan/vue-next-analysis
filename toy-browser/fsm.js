function match(str) {
	let state = start
	//遍历字符串
	for (const s of str) {
		// 找到当前值后，切换下一状态
		state = state(s)
		if (state === end) return true
	}
	return false
}

function start(s) {
	if (s === 'a') return foundA
	return start
}
function foundA(s) {
	if (s === 'b') return foundB//命中的的话切换到下一个状态，
	return start(s) // 否则重来
}
function foundB(s) {
	if (s === 'c') return foundC
	return start(s)
}
function foundC(s) {
	if (s === 'a') return foundA2
	return start(s)
}
function foundA2(s) {
	if (s === 'b') return foundB2
	return start(s)
}
function foundB2(s) {
	if (s === 'x') return end // ab
	return foundB(s) //  有可能是c 所以需要返回到 foundB
}

function end() { }

const str = 'aaaaabcabxaaaa'

console.log(match(str))
