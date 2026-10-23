const fs = require('fs'), path = require('path');
const { validPair } = require('../lib/rules');
function loadDictionary() {
  const dict = {};
  for (const file of ['api-zh.json', 'built-in.json', 'workbench-zh.json', 'corrections.json']) {
    Object.assign(dict, JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'translations', file), 'utf8')));
  }
  for (const [en, zh] of Object.entries(dict)) if (!validPair(en, zh)) throw new Error('词典占位符不一致：' + en);
  return dict;
}
module.exports = { loadDictionary };
