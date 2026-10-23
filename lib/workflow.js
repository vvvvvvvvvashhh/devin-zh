const fs = require('fs');
const os = require('os');
const path = require('path');
const { commit, state } = require('./files');
const df = require('./devin-files');
const lp = require('./lang-pack');
const { patch, restore } = require('./i18n-inject');
const { applyDom } = require('./dom-apply');
const { validateRules, domRules } = require('./rules');
const { extractNls } = require('./nls');

const policyFile = userDir => path.join(userDir, 'devin-zh.json');
function policy(userDir) { return state(policyFile(userDir)) || {}; }
function savePolicy(userDir, changes) {
  fs.mkdirSync(userDir, { recursive: true });
  const value = { ...policy(userDir), ...changes };
  validateRules(value);
  commit(new Map([[policyFile(userDir), JSON.stringify(value, null, 2) + '\n']]));
  return value;
}
function userDataFromStorage(storagePath) {
  const match = /[\\/]User[\\/](?:profiles[\\/][^\\/]+[\\/])?globalStorage(?:[\\/]|$)/i.exec(storagePath);
  if (!match) throw new Error('无法定位当前用户数据目录；未清理任何默认目录');
  return storagePath.slice(0, match.index);
}

// The same path is used by the extension, CLI and launcher. Prepare all outputs
// in a private staging directory, then commit bundles, backups, states, NLS and
// checksums together. A lock prevents competing windows from interleaving.
function run(options) {
  const app = df.appDir(options.appDir), userDir = df.userDataDir(options.userDataDir);
  let config = policy(userDir);
  if (options.restore) config = savePolicy(userDir, { paused: true });
  else if (!options.manual && (config.paused || config.autoApply === false)) return { paused: true, changed: 0, warnings: [] };
  const rules = { customTranslations: config.customTranslations || {}, exclude: config.exclude || [] };
  validateRules(rules);
  const lock = path.join(app, '.devin-zh-lock');
  if (fs.existsSync(lock)) {
    const owner = state(path.join(lock, 'owner.json'));
    let alive = true;
    if (owner && Number.isInteger(owner.pid)) {
      try { process.kill(owner.pid, 0); } catch (e) { if (e.code === 'ESRCH') alive = false; }
    }
    if (alive) throw new Error('另一个汉化操作正在运行；请稍后重试');
    fs.rmSync(lock, { recursive: true });
  }
  fs.mkdirSync(lock);
  let stage;
  try {
    fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid }));
    stage = fs.mkdtempSync(path.join(os.tmpdir(), 'devin-zh-stage-'));
    const expected = new Map(), mappings = new Map(), warnings = [], modified = [];
    const snapshot = (real, staged) => {
      fs.mkdirSync(path.dirname(staged), { recursive: true });
      const before = fs.existsSync(real) ? fs.readFileSync(real) : null;
      expected.set(real, before);
      mappings.set(real, staged);
      if (before !== null) fs.writeFileSync(staged, before);
    };
    const fileSet = (real, staged) => {
      for (const suffix of ['', '.en-backup', '.zh-state.json']) snapshot(real + suffix, staged + suffix);
    };
    snapshot(path.join(app, 'product.json'), path.join(stage, 'product.json'));
    // Snapshot all inputs before preparing the first patch.
    for (const relative of df.TARGETS) {
      const real = df.target(relative, app);
      if (!fs.existsSync(real)) throw new Error('目标版本缺少 bundle：' + relative);
      fileSet(real, df.target(relative, stage));
    }
    const official = options.officialPack === undefined ? lp.findOfficialPack({ extensionsDir: options.extensionsDir }) : options.officialPack;
    const stagedPack = path.join(stage, 'language-pack/main.i18n.json');
    if (official) fileSet(official, stagedPack);
    const root = options.extensionPath || path.join(__dirname, '..');
    const read = file => fs.readFileSync(path.join(root, 'translations', file), 'utf8');
    const zhT = options.restore ? null : read('catalogs/zh.translation.json');
    const zhR = options.restore ? null : read('catalogs/zh.review.json');
    const dict = options.restore ? null : domRules(JSON.parse(read('catalogs/dom-dict.json')), rules);
    for (const relative of df.TARGETS) {
      const file = df.target(relative, stage), before = fs.readFileSync(file, 'utf8');
      if (options.restore) restore(file);
      else {
        const result = patch(file, zhT, zhR, rules);
        if (result.reason) warnings.push(`${relative}：${result.reason}，仅 DOM 层可用`);
        applyDom(file, dict);
      }
      if (before !== fs.readFileSync(file, 'utf8')) modified.push(relative);
    }
    let packChanged = false;
    if (official) {
      if (options.restore) packChanged = lp.restoreOfficial({ file: stagedPack });
      else {
        let english;
        if (rules.exclude.length || Object.keys(rules.customTranslations).length) {
          english = extractNls(JSON.parse(fs.readFileSync(path.join(app, 'out/nls.metadata.json'), 'utf8')));
        }
        packChanged = lp.mergeIntoOfficial(read('main.i18n.json'), { file: stagedPack, rules, english }).changed;
      }
    } else if (!options.restore) warnings.push('当前 Devin 未安装官方中文语言包，NLS 层未应用');
    // Only successful bundle changes can change their corresponding checksums.
    if (modified.length) df.fixChecksums(stage, modified);
    const changes = new Map();
    for (const [real, staged] of mappings) changes.set(real, fs.existsSync(staged) ? fs.readFileSync(staged) : null);
    if (options.manual && !options.restore) {
      fs.mkdirSync(userDir, { recursive: true });
      changes.set(policyFile(userDir), JSON.stringify({ ...config, paused: false }, null, 2) + '\n');
    }
    commit(changes, expected);
    // Cache eviction happens only after a successful commit, in this profile.
    if (packChanged && !lp.clearClp(userDir)) warnings.push('语言包缓存清理失败，完全退出后重试');
    if (modified.length) {
      const cache = df.clearCodeCache(userDir);
      if (!cache.ok) warnings.push('代码缓存清理失败：' + cache.error);
    }
    return { changed: modified.length + Number(packChanged), modified, packChanged, warnings, paused: !!options.restore };
  } finally {
    if (stage) fs.rmSync(stage, { recursive: true, force: true });
    fs.rmSync(lock, { recursive: true, force: true });
  }
}
module.exports = { run, policy, savePolicy, userDataFromStorage };
