// Refresh the generated translation cache from reviewed corrections.
const fs = require('fs'), path = require('path');
const { validPair } = require('../lib/rules');
const dir = path.join(__dirname, '..', 'translations');
const cache = JSON.parse(fs.readFileSync(path.join(dir, 'api-zh.json'), 'utf8'));
const corrections = JSON.parse(fs.readFileSync(path.join(dir, 'corrections.json'), 'utf8'));
for (const [en, zh] of Object.entries(corrections)) {
  if (!validPair(en, zh)) throw new Error('人工校正占位符不一致：' + en);
  cache[en] = zh;
}
const invalid = Object.entries(cache).filter(([en, zh]) => !validPair(en, zh));
if (invalid.length) throw new Error('仍有无效译文：' + invalid.map(([en]) => en).join('\n'));
fs.writeFileSync(path.join(dir, 'api-zh.json'), JSON.stringify(cache));
console.log('已应用人工校正：', Object.keys(corrections).length);
