// 回归测试：DOM 显示层 runtime，在本机无头 Chrome/Edge 里跑真实 DOM，无需额外依赖。
// 用法：node tools/test-runtime.js   （可设 CHROME_PATH 指定浏览器；--cdp <ws> 复用已开调试端口的浏览器）
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { buildRuntime } = require('../lib/dom-runtime');

const dict = {
  'Open file': '打开文件', 'Automations': '自动化', 'MCP server': 'MCP 服务器',
  'Purchase extra usage or manage auto refill': '购买额外用量或管理自动续充',
  '{0} file': '{0} 个文件', 'Resets {0}': '重置于 {0}', 'Open {0}': '打开 {0}',
  'Search': '搜索', '{0} rules': '{0} 条规则', '{0} context': '{0} 个上下文', 'Open folder': '打开文件夹',
  'Type "{0}" to confirm': 'Type "{0}" to confirm', 'Type "DELETE" to confirm': '输入',
  'main': '主要', 'Re-index Wiki for "{0}"? This consumes ACUs ({1}) and should take 10–30 minutes.': '为“{0}”重建 Wiki 索引吗？这会消耗 ACU（{1}），预计需要 10–30 分钟。',
};

// 每个用例：setup 建 DOM，check 返回 [实际, 期望]
const cases = `
const T = [];
const add = (name, setup, check, wait) => T.push({ name, setup, check, wait: wait || 300 });
const el = (tag, txt, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; e.textContent = txt; document.body.appendChild(e); return e; };

add('精确词条', () => el('button', 'Automations'), e => [e.textContent, '自动化']);
add('模板不吞独立词条（Open file 不变成 打开 个文件）', () => el('button', 'Open file'), e => [e.textContent, '打开文件']);
add('模板正常替换', () => el('span', 'Resets 10月23日', 'label'), e => [e.textContent, '重置于 10月23日']);
add('模板拒绝散文捕获', () => el('span', 'Open a new session in this space now', 'label'), e => [e.textContent, 'Open a new session in this space now']);
add('聊天正文不翻', () => { const d = el('div', '', 'markdown-body'); d.appendChild(Object.assign(document.createElement('p'), { textContent: 'Search' })); return d; }, e => [e.textContent, 'Search']);
add('代码块不翻', () => el('code', 'Automations'), e => [e.textContent, 'Automations']);
add('UI 外长文本不翻', () => el('div', 'Automations are a feature that lets you run things on a schedule'), e => [e.textContent, 'Automations are a feature that lets you run things on a schedule']);
add('同一控件相邻纯文本节点整句命中', () => { const b = el('button', ''); b.append('Open ', 'file'); return b; }, e => [e.textContent, '打开文件']);
add('跨语义节点不合并或清空', () => { const b = el('button', ''); b.append('Open ', Object.assign(document.createElement('b'), { textContent: 'file' })); return b; }, e => [e.lastChild.textContent, 'file']);
add('嵌套 code 不清空', () => { const b = el('button', ''); b.append('Open ', Object.assign(document.createElement('code'), { textContent: 'file' })); return b; }, e => [e.lastChild.textContent, 'file']);
add('嵌套 Markdown 不清空', () => { const b = el('button', ''); b.append('Open ', Object.assign(document.createElement('span'), { className: 'markdown-body', textContent: 'file' })); return b; }, e => [e.lastChild.textContent, 'file']);
add('xterm 输出不翻', () => { const d = el('div', '', 'xterm'); d.appendChild(Object.assign(document.createElement('span'), { textContent: 'Search' })); return d; }, e => [e.textContent, 'Search']);
add('纯文本组合被 React 局部更新后重新计算', () => { const b = el('button', ''); b.append('Open ', 'file'); setTimeout(() => { b.lastChild.data = 'folder'; }, 150); return b; }, e => [e.textContent, '打开文件夹'], 500);
add('动态设为保护区恢复原文', () => { const b = el('button', 'Search'); setTimeout(() => b.setAttribute('data-zh-skip', ''), 150); return b; }, e => [e.textContent, 'Search'], 500);
add('元素移入聊天区恢复原文', () => { const d = el('div', ''); const b = document.createElement('button'); b.textContent = 'Search'; d.appendChild(b); setTimeout(() => { const p = document.createElement('div'); p.className = 'markdown-body'; d.appendChild(p); p.appendChild(b); }, 150); return d; }, e => [e.textContent, 'Search'], 500);
add('复数拆分清掉孤 s', () => { const b = el('button', ''); b.append(Object.assign(document.createElement('span'), { textContent: 'MCP server' }), Object.assign(document.createElement('span'), { textContent: 's' })); return b; }, e => [e.textContent, 'MCP 服务器']);
add('React 改回英文后重翻（doneEl 回归）', () => { const d = el('div', 'Purchase extra usage or manage auto refill', 'quota-bottom-action'); setTimeout(() => { d.firstChild.data = 'Purchase extra usage or manage auto refill'; }, 150); return d; }, e => [e.textContent, '购买额外用量或管理自动续充'], 500);
add('计数模板要求数字槽位（Manage rules 不成 Manage 条规则）', () => el('button', 'Manage rules'), e => [e.textContent, 'Manage rules']);
add('计数模板正常计数', () => el('button', '3 rules'), e => [e.textContent, '3 条规则']);
add('Clipboard context 不成 Clipboard 个上下文', () => el('span', 'Clipboard context', 'label'), e => [e.textContent, 'Clipboard context']);
add('属性翻译', () => { const i = document.createElement('input'); i.placeholder = 'Search'; document.body.appendChild(i); return i; }, e => [e.placeholder, '搜索']);
add('排除模板优先于更具体的内置译文', () => el('label', 'Type "DELETE" to confirm'), e => [e.textContent, 'Type "DELETE" to confirm']);
add('确认句中的分支名不因命中普通词典而被跳过', () => el('button', 'Re-index Wiki for "main"? This consumes ACUs (2) and should take 10–30 minutes.'), e => [e.textContent, '为“main”重建 Wiki 索引吗？这会消耗 ACU（2），预计需要 10–30 分钟。']);

(async () => {
  const out = [];
  for (const c of T) {
    const e = c.setup();
    await new Promise(r => setTimeout(r, c.wait));
    const [got, want] = c.check(e);
    out.push({ name: c.name, ok: got === want, got, want });
    e.remove();
  }
  const pre = document.createElement('pre'); pre.id = 'result'; pre.textContent = JSON.stringify(out);
  document.body.appendChild(pre);
})();
`;

// 用 CDP 驱动：新开空白页 → 注入 runtime + 用例 → 轮询结果
async function runCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = {};
  ws.onmessage = e => { const m = JSON.parse(e.data); if (pend[m.id]) { pend[m.id](m); delete pend[m.id]; } };
  const call = (method, params, sessionId) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const { result: { targetId } } = await call('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId } } = await call('Target.attachToTarget', { targetId, flatten: true });
  const ev = expr => call('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessionId).then(m => m.result && m.result.result && m.result.result.value);
  await ev('document.open();document.write("<!doctype html><meta charset=utf-8><body></body>");document.close();delete window.__devinZhDom');
  await ev(buildRuntime(dict).code);
  await ev(cases);
  let out = null;
  for (let k = 0; k < 100 && !out; k++) { await new Promise(r => setTimeout(r, 200)); out = await ev('(document.getElementById("result")||{}).textContent||null'); }
  await call('Target.closeTarget', { targetId });
  ws.close();
  return out;
}

function report(json) {
  if (!json) { console.log('未拿到结果'); process.exit(1); }
  const res = JSON.parse(json);
  let fail = 0;
  for (const r of res) {
    console.log(r.ok ? 'ok  ' : 'FAIL', r.name, r.ok ? '' : `\n     得到 ${JSON.stringify(r.got)}，期望 ${JSON.stringify(r.want)}`);
    if (!r.ok) fail++;
  }
  console.log(`\n${res.length - fail}/${res.length} passed`);
  process.exit(fail ? 1 : 0);
}

// --cdp <browser-ws-url>：复用已开着调试端口的浏览器/Devin（ws://.../devtools/browser/...）
const cdpArg = process.argv.indexOf('--cdp');
if (cdpArg > 0) { runCdp(process.argv[cdpArg + 1]).then(report); return; }

const browser = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(p => fs.existsSync(p));
if (!browser) { console.log('未找到 Chrome/Edge，设 CHROME_PATH'); process.exit(1); }

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devin-zh-rt-'));
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${port}`, `--user-data-dir=${path.join(dir, 'profile')}`, 'about:blank'], { stdio: 'ignore' });
const cleanup = () => { try { proc.kill(); } catch (e) { } setTimeout(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { } }, 500); };
(async () => {
  let ws = null;
  for (let k = 0; k < 60 && !ws; k++) {
    await new Promise(r => setTimeout(r, 250));
    try { ws = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; } catch (e) { }
  }
  if (!ws) { cleanup(); console.log('浏览器调试端口没起来'); process.exit(1); }
  const out = await runCdp(ws);
  cleanup();
  setTimeout(() => report(out), 600);
})();
