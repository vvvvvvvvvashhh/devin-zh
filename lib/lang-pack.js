const fs = require('fs');
const os = require('os');
const path = require('path');
const { isDeepStrictEqual } = require('util');
const { sha, commit, state } = require('./files');
const { overlayCatalog, validateRules } = require('./rules');
const MARK = '__devinZhMerged';
const PACK_RE = /^ms-ceintl\.vscode-language-pack-zh-hans-(\d+)\.(\d+)\.(\d+)/;

function findOfficialPack(options = {}) {
  if (options.extensionPath) {
    const file = path.join(options.extensionPath, 'translations', 'main.i18n.json');
    return fs.existsSync(file) ? file : null;
  }
  const root = options.extensionsDir || process.env.DEVIN_EXTENSIONS_DIR || path.join(os.homedir(), '.devin', 'extensions');
  if (!fs.existsSync(root)) return null;
  const obsolete = state(path.join(root, '.obsolete')) || {};
  const dirs = fs.readdirSync(root).filter(d => PACK_RE.test(d) && !obsolete[d]);
  dirs.sort((a, b) => {
    const x = a.match(PACK_RE).slice(1).map(Number), y = b.match(PACK_RE).slice(1).map(Number);
    for (let n = 0; n < 3; n++) if (x[n] !== y[n]) return y[n] - x[n];
    return b.localeCompare(a);
  });
  for (const dir of dirs) {
    const file = path.join(root, dir, 'translations/main.i18n.json');
    if (fs.existsSync(file)) return file;
  }
  return null;
}

function merged(original, ours) {
  const pkg = JSON.parse(original);
  pkg.contents = pkg.contents || {};
  for (const [mod, entries] of Object.entries(ours.contents || {})) {
    pkg.contents[mod] = { ...pkg.contents[mod], ...entries };
  }
  pkg[MARK] = 1;
  return JSON.stringify(pkg);
}

function originalPack(file) {
  const current = fs.readFileSync(file, 'utf8'), pkg = JSON.parse(current);
  if (!pkg[MARK]) return { current, original: current, patched: false };
  const backup = file + '.en-backup';
  if (!fs.existsSync(backup)) throw new Error('中文语言包原版备份丢失，请重新安装官方中文语言包');
  const original = fs.readFileSync(backup, 'utf8'), st = state(file + '.zh-state.json');
  if (st) {
    if (st.sourceHash !== sha(original) || st.patchedHash !== sha(current)) throw new Error('中文语言包的备份/状态不匹配，请重新安装官方中文语言包');
  } else {
    // <=0.1.4 had no state. Reconstruct that exact released transformation
    // against the backup; do not accept arbitrary marked files as a migration.
    const legacy = require('../translations/legacy-main.i18n.json');
    if (!isDeepStrictEqual(JSON.parse(merged(original, legacy)), pkg)) throw new Error('无法验证旧版语言包补丁，请重新安装官方中文语言包后应用');
  }
  return { current, original, patched: true };
}

function mergeIntoOfficial(oursJson, options = {}) {
  const file = options.file === undefined ? findOfficialPack(options) : options.file;
  if (!file) return { ok: false, reason: 'official-pack-not-found' };
  let ours = typeof oursJson === 'string' ? JSON.parse(oursJson) : oursJson;
  const rules = options.rules || {};
  validateRules(rules);
  if ((rules.exclude || []).length || Object.keys(rules.customTranslations || {}).length) {
    if (!options.english) throw new Error('自定义/排除 NLS 译文需要目标版本的 nls.metadata.json');
    ours = { contents: overlayCatalog(options.english, ours.contents, rules) };
  }
  const { current, original } = originalPack(file);
  const out = merged(original, ours);
  const next = JSON.stringify({ sourceHash: sha(original), patchedHash: sha(out) });
  const changedFiles = commit(new Map([[file + '.en-backup', original], [file, out], [file + '.zh-state.json', next]]),
    new Map([[file, current]]));
  return { ok: true, changed: out !== current, file, stateChanged: changedFiles.length > 0 };
}

function restoreOfficial(options = {}) {
  const file = options.file === undefined ? findOfficialPack(options) : options.file;
  if (!file || !fs.existsSync(file)) return false;
  const { current, original, patched } = originalPack(file);
  if (!patched) return false; // in-place official update: leave it untouched
  const changes = new Map([[file, original]]);
  if (fs.existsSync(file + '.zh-state.json')) changes.set(file + '.zh-state.json', null);
  commit(changes, new Map([[file, current]]));
  return true;
}

function clearClp(userDataDir) {
  try { fs.rmSync(path.join(userDataDir, 'clp'), { recursive: true, force: true }); return true; }
  catch (_) { return false; }
}
module.exports = { findOfficialPack, mergeIntoOfficial, restoreOfficial, clearClp };
