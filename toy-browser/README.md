# ToyBrowser

## Feature
通过 Server 向 ToyBrowser 发送一个 HTTP 响应报文，body 中带有 HTML 代码。那么 ToyBrowser 就可以解析此响应报文并将 body 中的 HTML 代码解析并渲染到一张图片上。

ToyBrowser 是一个玩具版的浏览器，它以 Toy 版的方式实现了浏览器中如下功能：
- HTTP 解析
- HTML 的解析
- DOM 树的生成
- CSS 的计算
- Flex 布局

## Explain

### server.js
server.js 的功能是向 client 发送响应报文。在 server.js 中有一个响应报文，响应报文的 body 中有一段 HTML 代码。

### client.js
client.js 是入口文件，它接受 server 发送的响应，并且完成 ToyBrowser 的一系列操作，最终将输出一张响应内容中 HTML 渲染后的图片。

### parser/httpParser.js
httpParser.js 的功能是解析 HTTP。解析的方式是使用状态机，并根据 HTTP 标准逐个解析报文中的 statusLine、headers 和 body，并将解析的结果封装成对象返回。

### parser/htmlParser.js
htmlParser.js 的功能是解析 HTML 代码并生成 DOM 数。原理和 httpParser 相同，使用状态机并根据 HTML 标准生成 DOM 树。

### parser/cssParser.js
cssParser.js 中实现了 CSS 规则收集和计算。通过 css 这个库解析收集的 CSS 规则，得到 CSS 规则的 AST 对象。然后经过匹配选择器、权重计算等操作后得出 ComputedStyle，并生成 LayoutTree 。

### layout.js
layout.js 实现了基本的 Flex 布局功能。flex-grow、flex-shrink、flex-basis 等特性还未实现。

### render.js
render.js 是将解析后生成的 LayoutTree 通过 images 这个库绘制到图片上。

### viewport.jpg
viewport.jpg 是渲染后输出的图片。

## Dependencies
- css: 将 CSS 字符串解析成 AST 对象
- images: 通过指令可画出图形并输出成图片

## Link