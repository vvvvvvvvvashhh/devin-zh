const fs = require('fs');
const acorn = require('../node_modules/acorn');
const { buildRuntime } = require('./dom-runtime');
const { sha, commit } = require('./files');
const ps = require('./patch-state');
const { MARKER } = ps;

function applyDom(file, dict) {
  const { current, original, st } = ps.source(file);
  const { code, exact, templates } = buildRuntime(dict);
  const at = current.indexOf(MARKER);
  const payload = MARKER + code;
  if (at >= 0 && current.slice(at) === payload) return { applied: false, reason: 'dom-already' };
  const src = at >= 0 ? current.slice(0, at).replace(/\n$/, '') : current;
  const out = src + '\n' + payload;
  acorn.parse(out, { ecmaVersion: 'latest', sourceType: 'module' });
  const next = { ...st, engineVersion: ps.ENGINE_VERSION, sourceHash: sha(original), patchedHash: sha(out),
    dom: { hash: sha(payload), exact, templates } };
  commit(new Map([[file + '.en-backup', original], [file, out], [file + '.zh-state.json', JSON.stringify(next, null, 2)]]),
    new Map([[file, current]]));
  return { applied: true, exact, templates };
}
function hasDom(file) {
  return fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes(MARKER);
}
module.exports = { applyDom, hasDom, MARKER };
