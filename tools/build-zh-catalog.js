// Build zh catalog JSONs from the extracted en catalogs + merged dict.
// Untranslated keys are OMITTED (i18next fallbackLng:"en" covers them).
// Output: translations/catalogs/zh.translation.json + zh.review.json
const fs = require('fs');
const path = require('path');
const D = path.join(__dirname, '..', 'translations');
const CAT = D + '/catalogs';
const dict = require('./dictionary').loadDictionary();
console.log('dict:', Object.keys(dict).length);

function translateTree(o, stats) {
  if (typeof o === 'string') {
    const zh = dict[o];
    if (zh && zh !== o) { stats.hit++; return zh; }
    stats.miss++; return undefined;
  }
  if (o && typeof o === 'object') {
    if (Array.isArray(o)) {
      const arr = o.map(v => translateTree(v, stats));
      return arr.some(v => v !== undefined) ? arr : undefined;
    }
    const out = {};
    for (const [k, v] of Object.entries(o)) {
      const t = translateTree(v, stats);
      if (t !== undefined) out[k] = t;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

const source = name => ({ f: name, obj: JSON.parse(fs.readFileSync(path.join(CAT, name), 'utf8')) });
const translation = source('en.translation.json'), review = source('en.review.json');
console.log('translation source:', translation && translation.f, '| review source:', review && review.f);
for (const [name, src] of [['zh.translation.json', translation], ['zh.review.json', review]]) {
  if (!src) { console.log('no source for', name); continue; }
  const stats = { hit: 0, miss: 0 };
  const zh = translateTree(src.obj, stats);
  fs.writeFileSync(CAT + '/' + name, JSON.stringify(zh));
  console.log(name, '| translated', stats.hit, '| left-en', stats.miss);
}
