// Run with extracted sources after a full build. Fail closed on damaged slots
// or keys, including safety/confirmation strings, instead of publishing them.
const fs = require('fs'), path = require('path'), assert = require('assert');
const { validPair } = require('../lib/rules');
const dir = path.join(__dirname, '..', 'translations');
const read = file => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
require('./dictionary').loadDictionary();
let checked = 0;
function tree(source, translated, name) {
  if (typeof translated === 'string') {
    assert.strictEqual(typeof source, 'string', '未知翻译键：' + name);
    assert.ok(validPair(source, translated), '占位符不一致：' + name);
    checked++;
  } else if (translated && typeof translated === 'object') {
    for (const [key, value] of Object.entries(translated)) {
      if (value !== null) tree(source && source[key], value, name + '.' + key);
    }
  }
}
for (const ns of ['translation', 'review']) tree(read(`catalogs/en.${ns}.json`), read(`catalogs/zh.${ns}.json`), ns);
tree(read('nls-devin.json'), read('main.i18n.json').contents, 'NLS');
for (const [en, zh] of Object.entries(read('catalogs/dom-dict.json'))) {
  assert.ok(validPair(en, zh), 'DOM 占位符不一致：' + en);
  checked++;
}
const t = read('catalogs/zh.translation.json');
assert.match(t.automations.codeStep.clearStateConfirmInputLabel, /\{\{word\}\}/);
assert.match(t.settings.deleteTierConfirmDescription, /\{\{name\}\}.*无法撤销/);
assert.match(t.wikiHeaderActions.dialogs.reindexConfirmationWithCost, /ACU.*\{\{cost\}\}.*10–30/);
console.log('翻译键/占位符检查通过：', checked);
