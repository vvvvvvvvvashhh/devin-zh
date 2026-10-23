// Build translations/main.i18n.json for the zh-hans language-pack contribution:
// {contents: {modulePath: {key: zh}}} from nls-devin.json (en) + merged dict.
const fs = require('fs');
const path = require('path');
const D = path.join(__dirname, '..', 'translations');
const nls = JSON.parse(fs.readFileSync(D + '/nls-devin.json', 'utf8'));
const dict = require('./dictionary').loadDictionary();
const contents = {};
let hit = 0, miss = 0;
for (const mod of Object.keys(nls)) {
  const out = {};
  for (const [key, en] of Object.entries(nls[mod])) {
    const zh = dict[en];
    if (zh && zh !== en) { out[key] = zh; hit++; } else miss++;
  }
  if (Object.keys(out).length) contents[mod] = out;
}
const pack = { contents };
fs.writeFileSync(D + '/main.i18n.json', JSON.stringify(pack, null, 1));
console.log('pack: translated', hit, '| untranslated kept-English', miss, '| modules:', Object.keys(contents).length);
