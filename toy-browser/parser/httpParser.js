class ResPonseParser {
  constructor() {
    this.state = this.waitingStatusLine;
    this.statusLine = '';
    this.headers = {};
    this.headerName = '';
    this.headerValue = '';
    this.bodyParser = null;
  }

  get isFinished() {
    return this.bodyParser && this.bodyParser.isFinished;
  }

  get response() {
    this.statusLine.match(/HTTP\/1.1 ([0-9]+) ([\s\S]+)/);
    return {
      statusCode: RegExp.$1,//正则拿到内容
      statusText: RegExp.$2,
      headers: this.headers,
      body: this.bodyParser.content.join(''), // body 内容
    }
  }

  receive(string) {
    // http字符串解析
    // 先对当前字符串做遍历拿到每一个字符，根据字符类型 切换到不同的状态
    //'HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nX-Foo: bar\r\nDate: Tue, 05 Jul 2022 07:54:05 GMT\r\nConnection: keep-alive\r\nKeep-Alive: timeout=5\r\nTransfer-Encoding: chunked\r\n\r\n213\r\n<html maaa=a >\n  <head>\n    <style>\n      #container {\n        width: 500px;\n        height: 300px;\n        display: flex;\n        background-color: rgb(255,255,255);\n      }\n      #container #myid {\n        width: 200px;\n        height: 100px;\n        background-color: rgb(255,0,0);\n      }\n      #container .c1 {\n        flex: 1;\n        background-color: rgb(0,255,0);\n      }\n    </style>\n  </head>\n  <body>\n      <div id="container">\n        <div id="myid"></div>\n        <div class="c1"></div>\n      </div>\n  </body>\n</html>\r\n0\r\n\r\n'
    //body:'<html maaa=a >\n  <head>\n    <style>\n      #container {\n        width: 500px;\n        height: 300px;\n        display: flex;\n        background-color: rgb(255,255,255);\n      }\n      #container #myid {\n        width: 200px;\n        height: 100px;\n        background-color: rgb(255,0,0);\n      }\n      #container .c1 {\n        flex: 1;\n        background-color: rgb(0,255,0);\n      }\n    </style>\n  </head>\n  <body>\n      <div id="container">\n        <div id="myid"></div>\n        <div class="c1"></div>\n      </div>\n  </body>\n</html>'
    //headers:{Content-Type: 'text/plain', X-Foo: 'bar', Date: 'Tue, 05 Jul 2022 07:58:09 GMT', Connection: 'keep-alive', Keep-Alive: 'timeout=5', …}
    //statusCode:'200'
    //statusText:'OK'
    string.split('').forEach(it => this.receiveChar(it));
  }
  // 状态机开始
  receiveChar(char) {
    // 根据char类型 进入不同的状态
    //初始状态为waitingStatusLine
    // this.state 没一次都会赋值， this.state没一次都是最新的状态机
    this.state = this.state(char);
  }

  /* ============================ paser statusLine ============================ */
  // 开始状态行
  waitingStatusLine(char) {
    switch (char) {
      // 如果碰见\r表示需要进入下一种状态了因为\r\n表示回车换行,表示第一个分片结束了
      case '\r':
        return this.waitingStatusLineEnd;
      case '\n':
        return this.waitingHeaderName;
      default:
        // 拿到状态行内容，就是第一行
        this.statusLine += char;
        return this.state;
    }
  }
  // 请求头结束
  waitingStatusLineEnd(char) {
    switch (char) {
      case '\n': // 如果在碰见\n 说明请求头的状态没了，需要进入 获得header 的状态了
        return this.waitingHeaderName;
      default:
        return this.state;
    }
  }

  /* ============================== paser headers ============================= */

  waitingHeaderName(char) {
    switch (char) {// 根据冒号来进入 值的状态
      case ':':
        return this.waitingHeaderSpace;
      case '\r':// 如果碰见\r 那么就表示要进入请求体的解析了
        //经过测试， 如果不指定Content-Type 那么就不会分片
        //如果Transfer-Encoding 有值 表示header 的解析已经结束
        if (this.headers['Transfer-Encoding'] === 'chunked') {
          // Transfer-Encoding: 指明了将实体传递给用户所采用的编码形式。
          //
          // @Syntax
          // chunked: 数据以一系列分块的形式进行发送。Content-Length 首部在这种情况下不被发送。
          //   在每一个分块的开头需要添加当前分块的长度，以十六进制的形式表示，后面紧跟着 '\r\n' ，
          //   之后是分块本身，后面也是'\r\n' 。终止块是一个常规的分块，不同之处在于其长度为0。
          //   终止块后面是一个挂载（trailer），由一系列（或者为空）的实体消息首部构成。
          // compress: 采用 Lempel-Ziv-Welch 压缩算法。这种内容编码方式已经被大部分浏览器弃用，部分因为专利问题（这项专利在2003年到期）。
          // deflate: 采用 zlib 结构 (在 RFC 1950 中规定)，和 deflate 压缩算法(在 RFC 1951 中规定)。
          // gzip: 表示采用 Lempel-Ziv coding (LZ77) 压缩算法，以及32位CRC校验的编码方式。
          // identity: 用于指代自身（例如：未经过压缩和修改）。除非特别指明，这个标记始终可以被接受。
          //
          // gzip, chunked: 可以是多个值，多个值之间以逗号分隔
          // 初始化请求体的状态机
          this.bodyParser = new TrunkedBodyParser();
        }
        return this.waitingHeaderBlockEnd;
      default:
        // 默认就会拿到 headerkey 内容
        this.headerName += char;
        return this.state;
    }
  }

  waitingHeaderValue(char) {
    switch (char) {
      case '\r': // 碰见\r 说明该换行了，将之前拿到的header 赋值
        this.headers[this.headerName] = this.headerValue;
        this.headerName = '';
        this.headerValue = '';
        return this.waitingHeaderLineEnd;// 重新进入下一个header的状态
      default:
        // 拿到header 的value内容
        this.headerValue += char;
        return this.state;
    }
  }

  waitingHeaderSpace(char) {
    switch (char) {
      case ' ': // 由于 一般情况下载冒号之后 会有一个空格 从而进入下一个状态
        return this.waitingHeaderValue;
      default:
        return this.state;
    }
  }

  waitingHeaderLineEnd(char) {
    switch (char) {
      case '\n':// 碰见\n表示要开始搜集下一个状态了
        return this.waitingHeaderName;
      default:
        return this.state;
    }
  }
  // header头的解析状态已经完事
  waitingHeaderBlockEnd(char) {
    switch (char) {
      case '\n':// 又会碰见/n开始拿到请求体解析  这里就是第二个\r\n
        return this.waitingBody;
      default:
        return this.state;
    }
  }

  /* =============================== parser body ============================== */

  waitingBody(char) {
    // 判断请求体的状态机是否初始化成功
    if (this.bodyParser) {
      // 如果初始化成功进入请求体的解析
      this.bodyParser.receiveChar(char);
    }
    return this.state;
  }
}

class TrunkedBodyParser {
  constructor() {
    this.state = this.waitingLength;
    this.length = 0;
    this.content = [];
    this.isFinished = false;
  }

  receiveChar(char) {
    this.state = this.state(char);
  }
  // 初始化默认状态
  waitingLength(char) {
    switch (char) {
      case '\r':  // 遇见\r 表示第一个分片要开始了
        return this.waitingStatusLineEnd;
      default:
        // console.log(parseInt(char, 16))
        // 默认情况下分块传输编码导致在当前的请求体的头部会显示传输长度
        // 一个汉字代表三个字节，所以此处就是代表每一个chunk的字节数，并且是16进制表示
        // 每一位乘16，就像十进制的时候每进一位就是乘10
        this.length *= 16;
        this.length += parseInt(char, 16); //213被转换为十进制的531表示有531个字节
        if (this.length === 0) { // 直到最后 为0 表示结束了
          // 如果下一行的长度为0，表明body结束
          this.isFinished = true;
        }
        return this.state;
    }
  }

  waitingStatusLineEnd(char) {
    switch (char) {
      case '\n':// 开始保存分片内容
        return this.readingTrunk;
      default:
        return this.state;
    }
  }

  readingTrunk(char) {
    if (this.isFinished) { // 如果我状态机走到最后，直接返回 这是是为了兼容在末尾的\r\n 此时收集已经结束了，直接返回即可，知道所有的data内容遍历完
      return this.state;
    }
    this.content.push(char);// 开始收集chunk的内容
    if (char.match(/^[\u4e00-\u9fa5]$/)) {
      // 判断是否是汉字，一个汉字三个字节
      this.length -= 3;
    } else {
      //否则就是一个字节
      this.length--;
    }
    // 每收集一个length-1 直到当前的分片内容收集完毕
    if (this.length === 0) {//length===0 的时候表示完毕
      return this.waitingNewLine; //然后到下一个状态也就是收集下一个 chunk
    }
    return this.state;
  }

  waitingNewLine(char) {
    switch (char) {
      case '\r':
        return this.waitingNewLineEnd;
      default:
        return this.state;
    }
  }

  waitingNewLineEnd(char) {
    switch (char) {
      case '\n':
        return this.waitingLength;
      default:
        return this.state;//也就是返回当前状态机，因为当前的状态没有变动
    }
  }
}

module.exports = ResPonseParser;
