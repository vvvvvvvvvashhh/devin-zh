// 回归测试：语言包合并进官方包，不覆盖官方译文；升级后刷新备份。用法：node tools/test-langpack.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'devin-zh-lp-'));
os.homedir = () => home; // lang-pack 在 ~/.devin/extensions 下找官方包
const lp = require('../lib/lang-pack');
const dir = path.join(home, '.devin', 'extensions', 'ms-ceintl.vscode-language-pack-zh-hans-1.0.0-universal', 'translations');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'main.i18n.json');
const official = v => JSON.stringify({ version: v, contents: { 'vs/settings': { textEditor: '文本编辑器' } } });
const ours = { contents: { 'vs/devin': { hello: '你好' }, 'vs/settings': { devin: 'Devin 设置' } } };
const read = () => JSON.parse(fs.readFileSync(file, 'utf8'));
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok', name); };

try {
  t('合并后保留官方译文', () => {
    fs.writeFileSync(file, official('1'));
    const r = lp.mergeIntoOfficial(ours);
    assert.ok(r.ok && r.changed);
    const p = read();
    assert.strictEqual(p.contents['vs/settings'].textEditor, '文本编辑器');
    assert.strictEqual(p.contents['vs/devin'].hello, '你好');
  });
  t('重复合并无改动', () => assert.strictEqual(lp.mergeIntoOfficial(ours).changed, false));
  t('官方包升级后重新合并并刷新备份', () => {
    fs.writeFileSync(file, official('2'));
    assert.ok(lp.mergeIntoOfficial(ours).changed);
    assert.strictEqual(JSON.parse(fs.readFileSync(file + '.en-backup', 'utf8')).version, '2');
  });
  t('还原到官方原版', () => {
    assert.ok(lp.restoreOfficial());
    const p = read();
    assert.strictEqual(p.version, '2');
    assert.strictEqual(p.contents['vs/devin'], undefined);
  });
  t('官方原地更新后还原不写回旧版本', () => {
    lp.mergeIntoOfficial(ours);
    fs.writeFileSync(file, official('3'));
    assert.strictEqual(lp.restoreOfficial(), false);
    assert.strictEqual(read().version, '3');
  });
  t('备份被替换时拒绝还原', () => {
    lp.mergeIntoOfficial(ours);
    fs.writeFileSync(file + '.en-backup', official('wrong'));
    assert.throws(() => lp.restoreOfficial(), /不匹配/);
    assert.strictEqual(read().version, '3');
  });
  t('按语义版本选择语言包，且不跨编辑器寻找', () => {
    for (const v of ['1.99.0', '1.100.0']) {
      const d = path.join(home, '.devin/extensions', `ms-ceintl.vscode-language-pack-zh-hans-${v}-universal`, 'translations');
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, 'main.i18n.json'), official(v));
    }
    assert.ok(lp.findOfficialPack().includes('1.100.0'));
    assert.strictEqual(lp.findOfficialPack({ extensionsDir: path.join(home, 'absent') }), null);
  });
  t('NLS 同时支持字符串与对象形式的键', () => {
    const { extractNls } = require('../lib/nls');
    const nls = extractNls({ keys: { 'vs/sessions/demo': ['first', { key: 'second' }] },
      messages: { 'vs/sessions/demo': ['First', 'Second'] } });
    assert.deepStrictEqual(nls['vs/sessions/demo'], { first: 'First', second: 'Second' });
  });
  t('旧语言包格式或键顺序变化不影响严格内容核验', () => {
    const target = path.join(home, 'legacy-formatted.json'), raw = official('4');
    const legacy = require('../translations/legacy-main.i18n.json');
    const contents = JSON.parse(raw).contents;
    for (const [mod, entries] of Object.entries(legacy.contents)) contents[mod] = { ...contents[mod], ...entries };
    // Key order, indentation and final newline differ from the old serializer.
    fs.writeFileSync(target, JSON.stringify({ __devinZhMerged: 1, contents, version: '4' }, null, 2) + '\n');
    fs.writeFileSync(target + '.en-backup', raw);
    assert.ok(lp.mergeIntoOfficial(ours, { file: target }).ok);
    assert.ok(lp.restoreOfficial({ file: target }));
    assert.strictEqual(fs.readFileSync(target, 'utf8'), raw);
  });
  t('旧语言包存在实际内容差异时仍拒绝迁移', () => {
    const target = path.join(home, 'legacy-altered.json'), raw = official('4');
    const legacy = require('../translations/legacy-main.i18n.json');
    const pkg = JSON.parse(raw);
    for (const [mod, entries] of Object.entries(legacy.contents)) pkg.contents[mod] = { ...pkg.contents[mod], ...entries };
    pkg.__devinZhMerged = 1;
    pkg.contents['vs/settings'].textEditor = 'unexpected change';
    const before = JSON.stringify(pkg, null, 2);
    fs.writeFileSync(target, before);
    fs.writeFileSync(target + '.en-backup', raw);
    assert.throws(() => lp.mergeIntoOfficial(ours, { file: target }), /无法验证/);
    assert.strictEqual(fs.readFileSync(target, 'utf8'), before);
  });
  console.log(`\n${n} passed`);
} finally {
  fs.rmSync(home, { recursive: true, force: true });
}
