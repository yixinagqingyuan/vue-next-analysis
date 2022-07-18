const { addCSSRules, computeCSS } = require('./cssParser');
const layout = require('../layout');

function isObjectLike(value) {
  return typeof value == "object" && value !== null
}


function isSymbol(value) {
  return (
    typeof value === "symbol" ||
    (isObjectLike(value) && Object.prototype.toString.call(value) === symbolTag)
  )
}
//<div id="asdfadf" 文件终结的时候，可能报错，所以需要用一个终结的内容来判断来杜绝有问题的标签情况
const EOF = Symbol('EOF'); // EOF: end of file
let currentToken = null;
let currentAttribute = null;
let currentTextNode = null;

let stack = [{ type: 'document', children: [] }];

function emit(token) {
  // 巧妙的利用栈的结构，先入先出，来完美匹配开始标签和结束标签
  // 如果当前token 是一个开始标签的话，那么从栈里面取出来的一定是一个开始标签，并且和当前的的token 是父子关系
  let top = stack[stack.length - 1];
  if (token.type === 'startTag') {
    let element = {
      type: 'element',
      tagName: token.tagName,
      children: [],
      attributes: [],
    };

    for (let p in token) {
      if (p !== 'type' && p !== 'tagName') {
        // 取出属性
        element.attributes.push({
          name: p,
          value: token[p],
        });
      }
    }

    // 当生成一个标签后就开始计算css
    computeCSS(element, stack);
    //所以当他 是开始标签的时候，我们直接能将当前元素塞到top 中，建立父子关系
    top.children.push(element);
    element.parent = top;
    // 如果你不是自封闭标签，那么就需要入栈然后等待结束标签的匹配，然后统一出栈
    if (!token.isSelfClosing) {
      stack.push(element);
    }
    currentTextNode = null;
  } else if (token.type === 'endTag') {
    // 如果是个结束标签  那天的top 也一定是个开始标签，但是他们是一对
    // 所以他们的tagname 一定要一样，如果不一样，那就说明你html 写错了
    if (top.tagName !== token.tagName) {
      throw new Error("Tag start end doesn't match!");
    } else {
      // 如果是样式内容，需要特殊处理
      if (top.tagName === 'style') {
        // 处理css 使用css 库解析css 
        addCSSRules(top.children[0].content);
      }
      // 这里发现css 的处理其实是伴随这html一同处理的
      // 根据css 计算位置
      layout(top); // 为什么在endTag时进行布局？因为要取到元素的子元素后才能布局
      //出栈将匹配到的内容出栈
      stack.pop();
    }
    //如果是结束标签， 那么说明文本内容一定是没有了将变量变为空
    currentTextNode = null;
    // 处理文本内容的情况
  } else if (token.type === 'text') {
    // 等于空的时候 表示文本的第一个内容要开始了
    if (currentTextNode === null) {
      // 先声明一个文本的对象
      currentTextNode = {
        type: 'text',
        content: "",
      };
      top.children.push(currentTextNode);
    }
    // 将所有的文本内容累加，由于文本内容是连续的，所以当他结束的时候，就会被endtag中的内容变为空，开始下一标签
    currentTextNode.content += token.content;
  }
}

function data(c) {
  //如果是左尖括号<div
  if (c === '<') {
    // 就需要开始搜集内容走到下一个状态开始标签状态
    return tagOpen;
  } else if (c === EOF) {//文件正常终结的情况
    emit({
      type: 'EOF',
    });
    return; // ? 为什么这里可以直接return，而不是return一个状态？ 这里本应该做一些容错处理
  } else {
    // 处理文本内容
    // 上来可能是有\r\n 还有一些文字，这些也会被放到children中
    emit({
      type: 'text',
      content: c,
    });
    // 返回处理当前状态，处理下一个标签
    return data;
  }
}

function tagOpen(c) {
  // 左尖括号有可能是开始标签，也有可能是结束标签<div></div><div/>
  if (c === '/') { // 判断带不带斜杠 从而判断是否进入结束标签的状态
    return endTagOpen;
  } else if (c.match(/^[a-zA-Z]$/)) {
    // 否则就开始搜集开始标签的内容
    // 先声明一个开始标签的token然后往里面填充内容
    currentToken = {
      type: 'startTag',
      tagName: '',
    };
    // 走收集标签名的状态
    return tagName(c);
  } else {
    // 有可能是<好好学>
    // 相当于是个兜底处理，一般人没人这么用
    emit({
      type: 'text',
      content: `<${c}`,
    });
    return data;
  }
}

function tagName(c) {
  // \s 等价于(/^[\t\n\f ]$/ 匹配空白字符< id='aa' div>
  // 如果当前标签中含有属性，一般多见于开始标签中 会命中当前状态
  if (!isSymbol(c) && c.match(/^[\t\n\f ]$/)) {
    //切换到处理属性的状态
    return beforeAttributeName;
  } else if (c === '/') {
    // 可能是自封闭标签<a/>
    return selfClosingStartTag;
    // 获取标签tag
  } else if (c.match(/^[a-zA-Z]$/)) {
    currentToken.tagName += c; // .toLowerCase(); // html的标准要求标签名小写
    return tagName;
  } else if (c === '>') {
    // 如果碰见结束标签 将当前标签推入ast，注意这里的结束> 可能有开始标签的结束，也可能有结束标签的结束
    emit(currentToken);
    // 重新开始下一个标签
    return data;
  } else if (c === EOF) {

  }
  else {
    // 兜底情况比如  <aa#sa></aa#sa> 也要能解析出来，但是没有实际意义
    currentToken.tagName += c;
    return tagName;
  }
}

function beforeAttributeName(c) {
  // \s 等价于(/^[\t\n\f ]$/ 匹配空白字符
  //可能别人写属性有多个空格的情况比如<div    id='asaa'></div>
  if (!isSymbol(c) && c.match(/^[\t\n\f ]$/)) {
    return beforeAttributeName;
    //还可能有<div     ></div>
    //  <img src="" alt=""   /> 自封闭标签情况也可能发生
  } else if (c === '/' || c === '>' || c === EOF) {
    // 继续处理属性中的这三中和情况
    return afterAttributeName(c);
  } else if (c === '=') {

  } else {
    currentAttribute = {
      name: '',
      value: '',
    };
    return attributeName(c);
  }
}

function attributeName(c) {
  // \s 等价于(/^[\t\n\f ]$/ 匹配空白字符
  // 属性名字，和属性值都是都需要过滤以下属性
  //换行、回车、/、> 或者是 EOF等字符时，标签已经结束
  if (!isSymbol(c) && c.match(/^[\t\n\f ]$/) || c === '/' || c === '>' || c === EOF) {
    return afterAttributeName(c);
  } else if (c === '=') {
    return beforeAttributeValue;
  } else if (c === '\u0000') {

  } else if (c === "\"" || c === "'" || c === '<') {

  } else {
    currentAttribute.name += c;
    return attributeName;
  }
}
// 等待属性内容
function beforeAttributeValue(c) {
  // \s 等价于(/^[\t\n\f ]$/ 匹配空白字符
  // 属性名字，和属性值都是都需要过滤以下属性
  //空格、换行、回车、/、> 或者是 EOF等字符时，我们继续往后寻找属性值
  if (!isSymbol(c) && c.match(/^[\t\n\f ]$/) || c === '/' || c === '>' || c === EOF) {
    return beforeAttributeValue;
  } else if (c === "\"") {
    // 双引号属性 的情况
    return doubleQuotedAttributeValue;
  } else if (c === "\'") {
    // 单引号属性的情况
    return singleQuotedAttributeValue;
  } else if (c === '>') {

  } else {
    // 既没有单引号，也没有双引号的情况 <div id=aaaa>
    return UnquotedAttributeValue(c);
  }
}

function doubleQuotedAttributeValue(c) {
  // 如果再次碰见双引号 说明搜集结束了
  //   完善currentToke
  if (c === "\"") {
    currentToken[currentAttribute.name] = currentAttribute.value;
    // 切换结束状态
    return afterQuotedAttributeValue;
  } else if (c === '\u0000') {

  } else if (c === EOF) {

  } else {
    // 开始搜集内容
    currentAttribute.value += c;
    return doubleQuotedAttributeValue;
  }
}

function singleQuotedAttributeValue(c) {
  // 再次遇见单引号 完善currentToken
  if (c === "\'") {
    currentToken[currentAttribute.name] = currentAttribute.value;
    // 准备推token
    return afterQuotedAttributeValue;
  } else if (c === '\u0000') {

  } else if (c === EOF) {

  } else {
    // 次数是正常搜集属性值
    currentAttribute.value += c;
    return singleQuotedAttributeValue;
    // return doubleQuotedAttributeValue; // ??
  }
}

function afterQuotedAttributeValue(c) {
  // \s 等价于(/^[\t\n\f ]$/ 匹配空白字符往前进一步 
  if (!isSymbol(c) && c.match(/^[\t\n\f ]$/)) {
    // 开始下一个属性收集
    return beforeAttributeName;

  } else if (c === '/') {
    // 自封闭标签
    return selfClosingStartTag;
  } else if (c === '>') {
    // 碰见结束标签开始推token
    currentToken[currentAttribute.name] = currentAttribute.value;
    emit(currentToken);
    return data;
  } else if (c === EOF) {

  } else {
    currentAttribute.value += c;
    return beforeAttributeValue(c);
    // return doubleQuotedAttributeValue; // ??
  }
}

function UnquotedAttributeValue(c) {
  // \s 等价于(/^[\t\n\f ]$/ 匹配空白字符
  if (!isSymbol(c) && c.match(/^[\t\n\f ]$/)) {
    // 如果碰见空格，那就说明搜集结束了，可以完善currentToken
    currentToken[currentAttribute.name] = currentAttribute.value;
    //  搜集下一个
    return beforeAttributeName;
  } else if (c === '/') {
    // 遇见自封闭 也表示结束了
    currentToken[currentAttribute.name] = currentAttribute.value;
    return selfClosingStartTag;
  } else if (c === '>') {
    // 遇见箭头也表示结束了
    currentToken[currentAttribute.name] = currentAttribute.value;
    // 推出token 
    emit(currentToken);
    // 从头开始
    return data;
  } else if (c === '\u0000') {

  } else if (c === "\"" || c === "\'" || c === '<' || c === '=' || c === "`") {

  } else if (c === EOF) {

  } else {
    //  正常搜集
    currentAttribute.value += c;
    return UnquotedAttributeValue;
  }
}

function afterAttributeName(c) {
  // \s 等价于(/^[\t\n\f ]$/ 匹配空白字符
  // 当前方法由于在多出使用，所以添加了一个为空的情况，往前进一步 
  if (!isSymbol(c) && c.match(/^[\t\n\f ]$/)) {
    return afterAttributeName;
  } else if (c === '/') {
    // 自封闭标签类型,表示已经取到属性，并且标签结束了<a href=' />
    return selfClosingStartTag;
  } else if (c === '=') {
    //<div id ='aaaa'></div> 返回 beforeAttributeValue取值
    return beforeAttributeValue;
  } else if (c === '>') {
    //  属性取值结束
    currentToken[currentAttribute.name] = currentAttribute.value;
    // 推入ast 
    emit(currentToken);
    // 处理下一个标签，下一个标签有可能是结束标签，也有可能是初始标签
    return data;
  } else if (c === EOF) {

  } else {
    // 兜底情况
    currentToken[currentAttribute.name] = currentAttribute.value;
    currentAttribute = {
      name: '',
      value: '',
    };
    return attributeName(c);
  }
}

function endTagOpen(c) {
  // 结束标签的状态
  if (c.match(/^[a-zA-Z]$/)) {
    //声明一个结束标签
    currentToken = {
      type: 'endTag',
      tagName: '',
    };
    // 返回下一个tagname状态机
    return tagName(c);
  } else if (c === EOF) {

  } else if (c === '>') {

  } else {

  }
}

function selfClosingStartTag(c) {
  // 如果后面跟了> 那就相当于自封闭标签关闭
  if (c === '>') {
    currentToken.isSelfClosing = true;
    // 将当前标签内容推入ast
    emit(currentToken);
    // 处理下一个标签
    return data;
  } else if (c === 'EOF') {

  } else {

  }
}

// 同样使用状态机处理html同时生成ast语法树
//https://astexplorer.net/
module.exports.parseHTML = function parseHTML(html) {
  // 开始状态机
  let state = data;
  for (let c of html) {
    state = state(c);
  }
  //<div id="asdfadf" 文件终结的时候，可能报错，所以需要用一个终结的内容来判断来杜绝有问题的标签情况
  state = state(EOF);
  return stack[0];
}
