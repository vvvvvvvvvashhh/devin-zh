// Extract Devin UI strings from two channels:
//  1) nls.metadata.json devin modules -> pack candidates (module->key->en)
//  2) sessions bundle embedded catalog -> patch candidates (en values)
// Output: translations/nls-devin.json + translations/catalog-en.json + a merged todo list
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'translations');
const APP = require('../lib/devin-files').appDir();
const meta = JSON.parse(fs.readFileSync(APP + '/out/nls.metadata.json', 'utf8'));
const nls = require('../lib/nls').extractNls(meta);
const nNls = Object.values(nls).reduce((sum, entries) => sum + Object.keys(entries).length, 0);
fs.writeFileSync(OUT + '/nls-devin.json', JSON.stringify(nls, null, 1));
console.log('nls modules:', Object.keys(nls).length, 'messages:', nNls);

// catalog: scan both bundles for "key":"value" pairs (values are display text)
const cat = new Map();
for (const f of ['out/vs/sessions/sessions.desktop.main.js', 'out/vs/workbench/windsurf-chat-client/index.js']) {
  const src = require('../lib/patch-state').source(APP + '/' + f).original;
  const re = /"[a-z][a-zA-Z0-9]{2,40}":"((?:[^"\\{}]|\\[^u]|\\u[0-9a-fA-F]{4}){2,400})"/g;
  let m;
  while ((m = re.exec(src))) {
    const v = m[1];
    if (cat.has(v)) { cat.get(v).files.add(f); continue; }
    cat.set(v, { files: new Set([f]) });
  }
}
// filter: keep human-facing sentences/phrases
const ok = s => {
  if (s.length < 3 || s.length > 300) return false;
  if (!/[A-Za-z]/.test(s)) return false;
  if (/^\d|^[\d\s.,:;()\-+*/=%@#$_]+$/.test(s)) return false;
  if (/[\\]|\\x|\\u/.test(s) && !/\\u20/.test(s)) {
    const dec = s.replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
    if (/[<>]/.test(dec)) return false;
  }
  if (/^https?:|^[\w.-]+\.\w{2,}([/?#]|$)/.test(s)) return false; // urls/domains
  if (/^[\w]+(\.[\w-]+){2,}$/.test(s)) return false;             // dotted ids
  if (/\$\{|\{\{|\[%|%\}/.test(s)) return false;                 // code templates
  if (!s.includes(' ') && s.length > 24 && /[a-z][A-Z]/.test(s)) return false; // camelCase blob
  return true;
};
const en = [...cat.keys()].filter(ok);
en.sort();
fs.writeFileSync(OUT + '/catalog-en.json', JSON.stringify(en, null, 1));
console.log('catalog raw pairs:', cat.size, '| kept sentences:', en.length);
// merged todo list (catalog + nls messages not already covered)
const nlsFlat = new Set();
for (const k of Object.keys(nls)) for (const key of Object.keys(nls[k])) nlsFlat.add(nls[k][key]);
const merged = new Set([...en, ...nlsFlat]);
fs.writeFileSync(OUT + '/todo-en.json', JSON.stringify([...merged].sort(), null, 1));
console.log('merged todo:', merged.size);
