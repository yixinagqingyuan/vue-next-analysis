//node:net 模块提供了异步的网络 API，用于创建基于流的 TCP链接
//https://blog.poetries.top/browser-working-principle/guide/part1/lesson01.html#%E8%BF%9B%E7%A8%8B%E5%92%8C%E7%BA%BF%E7%A8%8B
const net = require('net');
const HTTPParser = require('./parser/httpParser');
const HTMLParser = require('./parser/htmlParser');
const images = require('images');
const render = require('./render');

class Request {
  constructor(options) {
    // 初始化参数 拿到传入的初始参数，就相当于我们请求传入的参数
    this.method = options.method || 'GET';
    this.host = options.host;
    this.port = options.port || 80;
    this.path = options.path || '/';
    this.body = options.body || {};
    this.headers = options.headers || {};
    //设置默认头
    if (!this.headers['Content-Type']) {
      this.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    // 根据不同的类型做不同的body处理
    if (this.headers['Content-Type'] === 'application/json') {
      // 字符串形式的body 这是通常的json的传输方式
      this.bodyText = JSON.stringify(this.body);
      // 一般get 会用这种请求格式
    } else if (this.headers['Content-Type'] === 'application/x-www-form-urlencoded') {
      // 拼接成key=value&key=value的形式
      this.bodyText = Object.keys(this.body).map(key => `${key}=${encodeURIComponent(this.body[key])}`).join('&');
    }
    // 请求头长度
    this.headers['Content-Length'] = this.bodyText.length;
  }
  // 请求头拼接–> 请求行 + 请求头 + 空行 + 请求体 \n 换行 \r 回车
  toString() {
    // 注意拼接 必须为一下格式

    //POST / HTTP/1.1
    //X-Foo2: customed
    //Content-Type: application/x-www-form-urlencoded
    //Content-Length: 11

    //name=test
    const string = `${this.method} ${this.path} HTTP/1.1\r\n${Object.keys(this.headers).map(key => `${key}: ${this.headers[key]}`).join('\r\n')}\n\r\n${this.bodyText}`;
    // console.log(string)
    return string
  }

  send(connection) {
    // 使用promise 处理tcp请求
    return new Promise((resolve, reject) => {
      // 初始化一个状态机，  用于解析响应值
      const parser = new HTTPParser();
      if (connection) {
        // 如果已经建立链接，直接发送
        connection.write(this.toString());
      } else {
        // 否则说明没有建立链接开始建立链接
        connection = net.createConnection({
          host: this.host,
          port: this.port,
        }, () => {
          // 建立链接成功之后 发送内容
          connection.write(this.toString());
        });
      }
      // 监听data 的返回tcp 为流传输 并且为buffer 数据
      connection.on('data', (data) => {
        // buffer 流内容需要toString 变成字符串 data 就是响应内容，格式就是http 协议格式
        //  但是http 内容是一个文本内容，需要使用有限状态机进行格式化
        parser.receive(data.toString());
        if (parser.isFinished) {
          resolve(parser.response);
        }
        connection.end();
      });

      connection.on('error', (err) => {
        resolve(err);
        connection.end();
      });
    });
  }
}

void async function () {
  const request = new Request({
    method: 'POST',
    host: '127.0.0.1',
    port: '8088',
    headers: {
      'X-Foo2': 'customed'
    },
    body: {
      name: 'test'
    }
  });

  const response = await request.send();
  // 拿到html 
  // console.log(response.body);
  // 解析html
  const dom = HTMLParser.parseHTML(response.body);
  // console.log(dom)
  const viewport = images(800, 600);

  render(viewport, dom);

  viewport.save('viewport.jpg');
}();