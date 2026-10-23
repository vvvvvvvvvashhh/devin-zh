// Devin install file management: targets, backups, product.json checksum repair.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const APP = 'C:/Program Files (x86)/Devin/resources/app';
// app dir is usually <install>/resources/app — allow override for portability
function appDir(explicit) {
  const env = explicit || process.env.DEVIN_APP_DIR;
  if (env) {
    if (!fs.existsSync(path.join(env, 'product.json'))) throw new Error('DEVIN_APP_DIR/appRoot 无效：' + env);
    const product = JSON.parse(fs.readFileSync(path.join(env, 'product.json'), 'utf8'));
    if (!/devin/i.test([product.nameShort, product.nameLong, product.applicationName].join(' '))) throw new Error('目标不是 Devin 安装：' + env);
    return path.resolve(env);
  }
  // try common install roots on this platform
  const cands = [
    APP,
    'D:/Program Files (x86)/Devin/resources/app',
    'C:/Program Files/Devin/resources/app',
    path.join(os.homedir(), 'AppData/Local/Programs/Devin/resources/app'),
    '/Applications/Devin.app/Contents/Resources/app',
    '/usr/lib/devin/resources/app',
    '/opt/devin/resources/app',
  ];
  const found = cands.filter(c => fs.existsSync(path.join(c, 'product.json')));
  if (found.length !== 1) throw new Error('请设置 DEVIN_APP_DIR 明确选择一个 Devin resources/app 目录');
  return appDir(found[0]);
}

// patched targets (all relative to <app>/out)
const TARGETS = [
  'vs/sessions/sessions.desktop.main.js',
  'vs/workbench/windsurf-chat-client/index.js',
];

const sha256b64 = buf => crypto.createHash('sha256').update(buf).digest('base64').replace(/=+$/, '');

function target(file, app = appDir()) { return path.join(app, 'out', file); }
// after patching, rewrite product.json.checksums so VS Code's integrity check passes.
// product.json itself is not checksummed. Keeps its formatting where possible.
function fixChecksums(app = appDir(), modified = TARGETS) {
  const pjPath = path.join(app, 'product.json');
  const raw = fs.readFileSync(pjPath, 'utf8');
  let pj;
  try { pj = JSON.parse(raw); } catch (e) { throw new Error('product.json 无法解析'); }
  if (!pj.checksums) return { ok: true, updated: 0 };
  let updated = 0;
  for (const rel of modified) {
    if (!TARGETS.includes(rel)) throw new Error('拒绝改动非汉化目标的校验和：' + rel);
    if (!Object.hasOwn(pj.checksums, rel)) continue;
    const f = path.join(app, 'out', rel);
    const h = sha256b64(fs.readFileSync(f));
    if (pj.checksums[rel] !== h) { pj.checksums[rel] = h; updated++; }
  }
  if (updated) {
    require('./files').commit(new Map([[pjPath, JSON.stringify(pj, null, '\t') + '\n']]), new Map([[pjPath, raw]]));
  }
  return { ok: true, updated };
}

// V8 code cache is keyed by module path, NOT file contents — a repatched bundle
// still runs the OLD compiled code (stale embedded dict) until CachedData is wiped.
// Call after every repatch; takes effect on next Devin start.
function userDataDir(explicit) {
  if (explicit || process.env.DEVIN_USER_DATA_DIR) return path.resolve(explicit || process.env.DEVIN_USER_DATA_DIR);
  const base = process.platform === 'win32' ? (process.env.APPDATA || path.join(os.homedir(), 'AppData/Roaming'))
    : process.platform === 'darwin' ? path.join(os.homedir(), 'Library/Application Support')
    : (process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'));
  return path.join(base, 'Devin');
}

function clearCodeCache(userDir = userDataDir()) {
  const root = path.join(userDir, 'CachedData');
  const cleared = [];
  if (!fs.existsSync(root)) return { ok: true, cleared };
  try {
    for (const commit of fs.readdirSync(root)) {
      for (const sub of ['chrome/js', 'chrome/wasm']) {
        const d = path.join(root, commit, sub);
        if (fs.existsSync(d)) { fs.rmSync(d, { recursive: true, force: true }); cleared.push(d); }
      }
    }
  } catch (e) { return { ok: false, error: String(e), cleared }; }
  return { ok: true, cleared };
}

module.exports = { appDir, userDataDir, TARGETS, target, fixChecksums, sha256b64, clearCodeCache };
