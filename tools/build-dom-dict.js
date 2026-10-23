// Build en->zh flat map for DOM runtime from extracted en catalogs + zh catalogs.
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'translations', 'catalogs');
// 英文原文目录不进仓库（版权）：缺失时以现有 dom-dict.json 为底，只叠加人工译文，方便贡献者改词条
const SRC = ['en.translation.json', 'en.review.json'].map(f => path.join(DIR, f));
const fromSources = SRC.every(f => fs.existsSync(f));
const sources = fromSources ? SRC.map((file, i) => [
  flatten(JSON.parse(fs.readFileSync(file, 'utf8'))),
  flatten(JSON.parse(fs.readFileSync(path.join(DIR, ['zh.translation.json', 'zh.review.json'][i]), 'utf8'))),
]) : [];
function flatten(o, pre = '', out = {}) {
  for (const [k, v] of Object.entries(o)) {
    const p = pre ? pre + '.' + k : k;
    if (v && typeof v === 'object') flatten(v, p, out);
    else if (typeof v === 'string') out[p] = v;
  }
  return out;
}
// normalize i18next {{name}} placeholders to the runtime's {n} template format.
// name->index mapping is driven by the EN string so zh var order stays correct.
const normPair = (enS, zhS) => {
  const order = [];
  const en2 = enS.replace(/\{\{\s*([\w]+)\s*\}\}/g, (m, name) => {
    let i = order.indexOf(name);
    if (i < 0) { order.push(name); i = order.length - 1; }
    return '{' + i + '}';
  });
  const zh2 = zhS.replace(/\{\{\s*([\w]+)\s*\}\}/g, (m, name) => {
    const i = order.indexOf(name);
    return i < 0 ? m : '{' + i + '}';
  });
  return [en2, zh2];
};
const map = fromSources ? {} : JSON.parse(fs.readFileSync(path.join(DIR, 'dom-dict.json'), 'utf8'));
if (!fromSources) console.log('未找到英文原文目录，基于现有 dom-dict.json 增量叠加人工译文');
let hit = 0;
for (const [en, zh] of sources) for (const [k, enV] of Object.entries(en)) {
  const zhV = zh[k];
  if (typeof zhV === 'string' && zhV && zhV !== enV) { const [e, z] = normPair(enV, zhV); map[e] = z; hit++; }
}
// manual seeds for literals not in catalogs (sidebar JSX literals + windsurf settings panel)
const seeds = {
  'Sessions': '会话', 'New session': '新建会话', 'New Session': '新建会话',
  'Automations': '自动化', 'Oncall': '值守', 'Security': '安全', 'Wiki': 'Wiki',
  'Cloud settings': '云端设置', 'MCP servers': 'MCP 服务器', 'Devin Local': 'Devin 本地',
  'Customizations': '自定义', 'Review': '审查', 'Spaces': '空间',
  'Bypass Permissions': '跳过权限确认', 'Untitled': '未命名',
  'Devin Cloud': 'Devin 云端', 'Settings': '设置', 'Search': '搜索',
  // windsurf statusbar settings panel (workbench literals)
  'Aggression': '积极程度', 'Completion mode': '补全模式', 'Tab to import': 'Tab 导入', 'Tab to jump': 'Tab 跳转',
  'Advanced Settings': '高级设置', 'Plan Info': '套餐信息', 'AI Shortcuts': 'AI 快捷键',
  'Supercomplete': '超级补全', 'Autocomplete': '自动补全', 'Cascade': 'Cascade',
  // windsurf plan/quota popover (workbench literals)
  'Quota resets daily/weekly': '配额每日/每周重置', 'Quota resets daily': '配额每日重置', 'Quota resets weekly': '配额每周重置',
  'Daily quota usage:': '每日配额用量：', 'Weekly quota usage:': '每周配额用量：', 'Extra usage balance:': '额外用量余额：',
  'Purchase extra usage or manage auto refill': '购买额外用量或管理自动续充',
  'Purchase extra usage to continue using premium models': '购买额外用量以继续使用高级模型',
  'Resets {0}': '重置于 {0}', 'Plan ends in {0}': '套餐将于 {0} 到期',
  'Plan ends in': '套餐到期还剩', 'Plan ends in ': '套餐到期还剩 ', 'Quota resets daily/weekly ': '配额每日/每周重置', 'Purchase extra usage or manage auto refill →': '购买额外用量或管理自动续充 →',
  'Quota resets daily/weekly\nPlan ends in': '配额每日/每周重置\n套餐到期还剩', 'Quota resets daily\nPlan ends in': '配额每日重置\n套餐到期还剩', 'Quota resets weekly\nPlan ends in': '配额每周重置\n套餐到期还剩',
  'Split into new space': '拆分到新空间', 'Model Request': '模型请求', 'Devin - Settings': 'Devin - 设置',
  'Pro - Extra Usage Active': 'Pro - 额外用量已启用', 'Agent': '智能体',
  // 菜单栏（助记符下划线把 S|election 拆成两个节点，靠整句命中）
  'Selection': '选择', 'Go': '转到',
  'days': '天', 'day': '天',
  // welcome / quick-open menu phrases (split-node strings need element-level hits)
  'Start a new session in this space': '在此空间启动新会话',
  'a new session in this space': '在此空间启动新会话',
  'Open a file': '打开文件', 'Open file': '打开文件', 'Open a file from the workspace': '打开工作区中的文件',
  'a file from the workspace': '打开工作区中的文件',
  'Open customizations': '打开自定义', 'customizations': '自定义',
  'Manage rules, skills, MCPs and plugins': '管理 rules、skills、MCP 和插件',
  'View diffs': '查看差异', 'View all file changes in this space': '查看此空间的全部文件更改',
  'View shell history': '查看 shell 历史', 'Past shell commands run in this space': '此空间运行过的 shell 命令',
  "Open Devin's computer": '打开 Devin 的电脑', 'View the Devin Cloud computer': '查看 Devin Cloud 电脑',
  "Open terminal on Devin's machine": '打开 Devin 机器上的终端', 'Open a terminal connected to the Devin Cloud session': '打开连接到 Devin Cloud 会话的终端',
  'No changes available yet': '暂无可查看的更改',
};
// 人工译文优先于机翻目录（如产品名 Cascade 不能被译成"级联"）
for (const [k, v] of Object.entries(seeds)) map[k] = v;
// workbench 设置面板/扩展描述等人工校对译文（tools/extract-workbench.js 抽出的待翻项）
const wb = JSON.parse(fs.readFileSync(path.join(DIR, '..', 'workbench-zh.json'), 'utf8'));
for (const [k, v] of Object.entries(wb)) map[k] = v;
const corrections = JSON.parse(fs.readFileSync(path.join(DIR, '..', 'corrections.json'), 'utf8'));
for (const [k, v] of Object.entries(corrections)) { const [en, zh] = normPair(k, v); map[en] = zh; }
// extract-workbench.js 抽出、经 translate-batch.js 机翻进 api-zh.json 的条目
try {
  const todoWb = JSON.parse(fs.readFileSync(path.join(DIR, '..', 'todo-workbench.json'), 'utf8'));
  const api = JSON.parse(fs.readFileSync(path.join(DIR, '..', 'api-zh.json'), 'utf8'));
  for (const k of todoWb) if (!map[k] && api[k] && api[k] !== k) map[k] = api[k];
} catch (e) { }
for (const [en, zh] of Object.entries(map)) if (!require('../lib/rules').validPair(en, zh)) throw new Error('DOM 词典占位符不一致：' + en);
fs.writeFileSync(path.join(DIR, 'dom-dict.json'), JSON.stringify(map, null, 1));
console.log('dom dict:', Object.keys(map).length, 'entries (', hit, 'from catalogs + seeds )');
console.log('spot:', ['Automations', 'Oncall', 'Cloud settings', 'New session', 'Bypass Permissions'].map(k => k + '=' + map[k]).join(' | '));
