const css = require('css');

// 加入一个新的函数，addCSSRules，这里我们把CSS规则暂存到一个数组里
let rules = [];
// [{
//   type: 'rule',
//   selectors: [ 'body div #myid' ],
//   declarations: [
//     [{
//         type: 'declaration',
//         property: 'width',
//         value: '100px',
//         position: [Object]
//     }, {
//         type: 'declaration',
//         property: 'background-color',
//         value: '#ff5000',
//         position: [Object],
//     }]],
//   type: 'rule',
//   selectors: [ 'body div img' ],
//   declarations: [ [Object], [Object] ],
//   position: Position { start: [Object], end: [Object], source: undefined }
// }]

//document.styleSheets
function addCSSRules(text) {
  // 使用css库将文本转为ast 
  const ast = css.parse(text);
  // 保存到rules中方便后续匹配
  rules.push(...ast.stylesheet.rules);
}

function match(element, selector) {
  // element:
  // {
  //   type: 'element',
  //   tagName: 'img',
  //   children: [],
  //   attributes: [ { name: 'isSelfClosing', value: true } ],
  //   computedStyle: {}
  // }
  // selector: 'img'
  // 如果没有选择器，说明 完全不匹配，压根不行
  if (!selector || !element.attributes) {
    return false;
  }
  // 表示是id 匹配
  if (selector.charAt(0) === '#') {
    const attr = element.attributes.filter(attr => attr.name === 'id')[0];
    if (attr && attr.value === selector.replace('#', '')) {
      return true;
    }
    // class 匹配
  } else if (selector.charAt(0) === '.') {
    const attr = element.attributes.filter(attr => attr.name === 'class')[0];
    if (attr && typeof attr.value === 'string') {
      // 实现支持空格的class选择器
      const classList = attr.value.split(' ');
      if (classList.includes(selector.replace('.', ''))) {
        return true;
      }
    }
    // if (attr && attr.value === selector.replace('.', '')) {
    //   return true;
    // }
  } else if (element.tagName === selector) {
    return true;
  }
  return false;
}
//计算优先级权重
//首先 specifity 会有四个元素
//按照 CSS 中优先级的顺序来说就是 inline style > id > class > tag
//所以把这个生成为 specificity 就是 [0, 0, 0, 0]
//数组里面每一个数字都是代表在样式表中出现的次数
//CSS 规则根据 specificity 和后来优先规则覆盖
//specificity 是个四元组，越左边权重越高
//一个 CSS 规则的 specificity 根据包含的简单选择器相加而成
function specificity(selector) {
  // p[0]: inline
  // p[1]: id
  // p[2]: class
  // p[3]: tagName
  let p = [0, 2, 0, 0];
  const selectorParts = selector.split(' ');
  for (let part of selectorParts) {
    if (part.charAt(0) === '#') {
      p[1] += 1;
    } else if (part.charAt(0) === '.') {
      p[2] += 1;
    } else {
      p[3] += 1;
    }
  }
  return p;
}
//对比两个选择器的 权重
// 这里就是比如后面有一个选择器覆盖另一个  根据他们的四元组大小，选出权重
function compara(sp1, sp2) {
  if (sp1[0] - sp2[0]) {
    return sp1[0] - sp2[0];
  }
  if (sp1[1] - sp2[1]) {
    return sp1[1] - sp2[1];
  }
  if (sp1[2] - sp2[2]) {
    return sp1[2] - sp2[2];
  }
  return sp1[3] - sp2[3];
}

function computeCSS(element, stack) {
  // stack将数组翻转
  //因为栈里面的元素是会不断的变化的，所以后期元素会在栈中发生变化，就会可能被污染。所以这里我们用了一个slice来复制这个元素。
  //然后我们用了 reverse() 把元素的顺序倒过来，为什么我们需要颠倒元素的顺序呢？是因为我们的标签匹配是会从当前元素开始逐级的往外匹配（也就是一级一级往父级元素去匹配的）
  // 栈是后来者居上，需要翻转一下
  const elements = stack.slice().reverse();
  // 如果当前节点没有comqputedStyle 赋值一个
  if (!element.computedStyle) {
    // 给element增加computedStyle属性
    element.computedStyle = {};
  }
  // 开始拿到样式规则数组去匹配
  for (let rule of rules) {
    // rule:
    // { type: 'rule',
    //   selectors: [ 'body div img' ],
    //   declarations: [{
    //       type: 'declaration',
    //       property: 'width',
    //       value: '30px',
    //       position: [Object]
    //     }, {
    //       type: 'declaration',
    //       property: 'background-color',
    //       value: '#ff1111',
    //       position: [Object]
    //   }],
    //   position: [Object]
    // }

    // reverse的原因是，css选择器是右向左逐个匹配 ，但是ast顺序和我们要使用的不一致
    // 这里循环 CSS 规则，让规则与元素匹配
    // 1.  如果当前选择器匹配不中当前元素直接 continue
    // 2. 当前元素匹配中了，就一直往外寻找父级元素找到能匹配上选择器的元素
    // 3. 最后检验匹配中的元素是否等于选择器的总数，是就是全部匹配了，不是就是不匹配
    // 取到当前规则的选择器 翻转一下相当于是从后往前匹配 
    //['#myid',#container]
    const selectorParts = rule.selectors[0].split(' ').reverse();
    // 先匹配当前元素
    if (!match(element, selectorParts[0])) {
      // 不匹配则跳出 本次循环，开始下一次
      // 此时，如果最后一个元素不匹配当前的 属性，那么一定是这个规则不匹配这个标签
      // 这样他的祖先元素也不需要处理
      continue;
    }

    let matched = false;
    let j = 1;//第0个已经比较过了所以我们从1开始 相当于 在祖先中寻找匹配的选择器，从而确认最终是否匹配
    //比如 ['#myid','#a'] ['#myid',#container]
    //  栈里面的祖先全部遍历
    for (let i = 0; i < elements.length; i++) {
      // 然后在匹配栈里面的一级一级的兄弟元素或者祖先元素，由于栈里面存的都是开始标签，
      // 所以计算样式都是在当前开始标签存入栈之前就开始计算，然后带着计算完之后的内容一同压入栈
      if (match(elements[i], selectorParts[j])) {
        //如果祖先元素和后续选择器匹配了
        j++;
      }
    }
    // 命中了规则
    // j 如果等于选择器，那么就说明他的每一个在祖先中都匹配上了 

    if (j >= selectorParts.length) {
      matched = true;
    }
    //开始计算样式
    if (matched) {
      // 匹配了以后，首先计算权重
      // 这个是为了防止权重覆盖，如果不覆盖，其实是没用的
      const sp = specificity(rule.selectors[0]);
      const computedStyle = element.computedStyle;
      // 接下来就是将样式写到标签里面就可以了
      for (let declaration of rule.declarations) {
        if (!computedStyle[declaration.property]) {
          computedStyle[declaration.property] = {};
        }
        if (
          !computedStyle[declaration.property].specificity ||
          // 选择器覆盖的情况要计算权重
          compara(computedStyle[declaration.property].specificity, sp) < 0
        ) {
          // 赋值对应的属性
          computedStyle[declaration.property].value = declaration.value;
          // 赋值权重，也可能是更新权重
          computedStyle[declaration.property].specificity = sp;
        }
      }
    }
  }
}


module.exports = {
  addCSSRules,
  computeCSS,
};
