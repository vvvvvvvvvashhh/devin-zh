const fs = require('fs');
const { sha, state } = require('./files');
const MARKER = '/*devin-zh-dom*/';
const ENGINE_VERSION = 2;
const marked = s => s.includes('["zh"]={translation:JSON.parse(') || s.includes('/*devin-zh-i18n*/') || s.includes(MARKER);
function matches(src, st) {
  if (!st) return false;
  if (sha(src) === st.patchedHash) return true;
  // <=0.1.4 recorded the pre-DOM hash. Verify that exact base when migrating.
  const at = src.indexOf(MARKER);
  if (!st.engineVersion && st.dom && at >= 0) {
    let base = src.slice(0, at);
    // Old DOM replacements could add another separator newline each time.
    while (base.endsWith('\n')) {
      base = base.slice(0, -1);
      if (sha(base) === st.patchedHash) return true;
    }
  }
  return false;
}
function source(file) {
  const current = fs.readFileSync(file, 'utf8'), st = state(file + '.zh-state.json');
  const backup = file + '.en-backup';
  const original = fs.existsSync(backup) ? fs.readFileSync(backup, 'utf8') : null;
  if (marked(current) || (st && sha(current) === st.patchedHash && sha(current) !== st.sourceHash)) {
    if (!st || original === null || sha(original) !== st.sourceHash || !matches(current, st)) {
      throw new Error('backup-mismatch：补丁状态或英文备份不匹配，请重新安装 Devin 后应用');
    }
    return { current, original, st, patched: true };
  }
  if (!st && original !== null && sha(original) !== sha(current)) throw new Error('状态丢失，不能确认备份归属；未覆盖备份');
  return { current, original: current, st, patched: false };
}
module.exports = { source, matches, marked, MARKER, ENGINE_VERSION };
