// 抽取 Windsurf 设置面板（workbench）和 Devin 智能体设置（sessions/chat-client）及状态栏面板的显示文案，
// 输出词典里还没有的英文到 translations/todo-workbench.json，供 translate-batch.js 翻译。
// 用法：node tools/extract-workbench.js
const fs = require('fs');
const path = require('path');
const df = require('../lib/devin-files');

// 三个 bundle 都扫：Windsurf 设置面板在 workbench，Devin 智能体设置在 sessions/chat-client
const files = ['vs/workbench/workbench.desktop.main.js', ...df.TARGETS].map(f => df.target(f));
const read = f => fs.readFileSync(fs.existsSync(f + '.en-backup') ? f + '.en-backup' : f, 'utf8');
const T = path.join(__dirname, '..', 'translations');

const set = new Set();
const re = /(?:label|title|description|tooltip|placeholder|category|header|subtitle):\[?"([A-Z][^"\\]{2,200})"/g;
// 锚点：设置项对象（category 字面量或变量、label+description 数组）和状态栏设置面板类名附近
for (const f of files) {
  const s = read(f);
  const anchors = [...s.matchAll(/category:(?:"[A-Z][^"]+"|[\w$]+,options:)|label:"[A-Z][^"]+",description:\[|windsurf-statusbar-settings-panel|quota-bottom-action/g)].map(x => x.index);
  for (const i of anchors) {
    const seg = s.slice(Math.max(0, i - 1500), i + 1500);
    let m;
    while ((m = re.exec(seg))) set.add(m[1]);
  }
}
const dict = JSON.parse(fs.readFileSync(path.join(T, 'catalogs', 'dom-dict.json'), 'utf8'));
const api = JSON.parse(fs.readFileSync(path.join(T, 'api-zh.json'), 'utf8'));
const all = [...set].filter(t => /[a-z]/.test(t) && !/^[A-Z][a-zA-Z]+\.[a-zA-Z]/.test(t)); // 排除 Foo.bar 这类标识符
const todo = all.filter(t => !dict[t] && !api[t]);
fs.writeFileSync(path.join(T, 'todo-workbench.json'), JSON.stringify(todo, null, 1));
console.log('候选', all.length, '| 已在词典', all.length - all.filter(t => !dict[t]).length, '| api-zh 已有', all.filter(t => !dict[t] && api[t]).length, '| 待翻', todo.length);
