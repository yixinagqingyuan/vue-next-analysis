//https://github.com/zhangyuanwei/node-images
const images = require('images');
// 将带css的dom转化为带位置信息的dom进行绘制
function render(viewport, element) {
  if (element.style) {
    const img = images(element.style.width, element.style.height);
    if (element.style['background-color']) {
      const color = element.style['background-color'] || 'rgb(0,0,0)';
      color.match(/rgb\((\d+),(\d+),(\d+)\)/);
      img.fill(Number(RegExp.$1), Number(RegExp.$2), Number(RegExp.$3), 1);
      viewport.draw(img, element.style.left || 0, element.style.top || 0);
    }
  }
  if (element.children) {
    for (let child of element.children) {
      render(viewport, child);
    }
  }
}

module.exports = render;
