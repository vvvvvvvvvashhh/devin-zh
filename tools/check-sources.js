// npm run build 前置检查：英文原文中间产物不进仓库（版权），需先从本机 Devin 安装目录抽取。
const fs = require('fs');
const path = require('path');
const T = path.join(__dirname, '..', 'translations');
const need = ['nls-devin.json', 'catalogs/en.translation.json', 'catalogs/en.review.json'];
const miss = need.filter(f => !fs.existsSync(path.join(T, f)));
if (miss.length) {
  console.log('缺少英文原文：' + miss.join('、'));
  console.log('请先在装有 Devin 的机器上运行：node tools/extract.js && node tools/extract-catalog.js');
  console.log('（只改译文不需要重建：仓库里已带建好的 translations/catalogs/zh.*.json 与 dom-dict.json，可直接 npm run pack）');
  process.exit(1);
}
