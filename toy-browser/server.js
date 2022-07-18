const http = require('http');
// 启动一个node服务，为了让客户端拿到值
const server = http.createServer((req, res) => {
  console.log('服务回调')
  // 设置文件Content-Type 经过测试 如果不设置  Transfer-Encoding 就不会有 从而也不会走分片

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('X-Foo', 'bar');
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(
    `<html maaa=a >
  <head>
    <style>
      #container {
        width: 500px;
        height: 300px;
        display: flex;
        background-color: rgb(255,255,255);
      }
      #container #myid {
        width: 200px;
        height: 100px;
        background-color: rgb(255,0,0);
      }
      #container .c1 {
        flex: 1;
        background-color: rgb(0,255,0);
      }
      #container .c1 {
        flex: 1;
        background-color: rgb(0,255,1);
      }
    </style>
  </head>
  <body>
      <div id="container">
        <div id="myid"><爱好></div>
        <div class="c1"></div>
      </div>
  </body>
</html>`);
});

server.listen(8088, () => {
  console.log('listen on port: 8088');
});
