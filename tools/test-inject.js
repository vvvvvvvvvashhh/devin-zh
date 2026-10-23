// 回归测试：i18n 注入 + 备份/还原在 Devin 更新场景下的行为。用法：node tools/test-inject.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { patch, restore } = require('../lib/i18n-inject');
const { applyDom } = require('../lib/dom-apply');
const vm = require('vm');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devin-zh-test-'));
const file = path.join(dir, 'bundle.js');
const bundle = ver => `var V="${ver}";var T={a:"Open"};let r={en:{translation:T,review:q}};function f(){return i.use(x).init({resources:r,lng:"en",fallbackLng:"en"})}`;
const zh1 = JSON.stringify({ a: '打开' }), zh2 = JSON.stringify({ a: '打开（新）' });
const has = s => fs.readFileSync(file, 'utf8').includes(s);
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok', name); };

try {
  t('首次注入并生成备份', () => {
    fs.writeFileSync(file, bundle('v1'));
    assert.ok(patch(file, zh1).applied);
    assert.ok(has('lng:"zh"') && has('打开'));
    assert.ok(fs.readFileSync(file + '.en-backup', 'utf8').includes('V="v1"'));
  });
  t('同词典重复注入幂等', () => {
    assert.ok(patch(file, zh1).alreadyPatched);
  });
  t('词典变化从原版重打', () => {
    assert.ok(patch(file, zh2).applied);
    assert.ok(has('打开（新）') && !has('JSON.parse(\'{"a":"打开"}\')'));
  });
  t('Devin 更新后刷新备份，不写回旧版', () => {
    fs.writeFileSync(file, bundle('v2')); // 模拟更新：新版原文覆盖已打补丁文件
    assert.ok(patch(file, zh2).applied);
    assert.ok(has('V="v2"'));
    assert.ok(fs.readFileSync(file + '.en-backup', 'utf8').includes('V="v2"'));
  });
  t('备份与状态不符时拒绝重打', () => {
    fs.writeFileSync(file + '.en-backup', bundle('v0-stale'));
    assert.throws(() => patch(file, zh1), /backup-mismatch/);
    assert.throws(() => restore(file), /backup-mismatch/);
    assert.ok(has('V="v2"'));
  });
  t('更新后（无标记原版）还原不覆盖', () => {
    fs.writeFileSync(file, bundle('v3'));
    assert.strictEqual(restore(file), false);
    assert.ok(has('V="v3"'));
  });
  t('正常还原', () => {
    assert.ok(patch(file, zh1).applied);
    assert.ok(restore(file));
    assert.strictEqual(fs.readFileSync(file, 'utf8'), bundle('v3'));
  });
  t('同长度 DOM 译文修改必须生效', () => {
    patch(file, zh1);
    applyDom(file, { Search: '搜索' });
    const before = fs.readFileSync(file, 'utf8');
    assert.ok(applyDom(file, { Search: '查找' }).applied);
    assert.notStrictEqual(fs.readFileSync(file, 'utf8'), before);
    assert.strictEqual(applyDom(file, { Search: '查找' }).applied, false);
    assert.ok(restore(file));
    assert.strictEqual(fs.readFileSync(file, 'utf8'), bundle('v3'));
  });
  t('i18next 排除和自定义规则使用真实英文资源，排除优先', () => {
    const source = 'var T={a:"Open",b:"Search"},q={},x={},i={use(){return this},init(v){return v}};let r={en:{translation:T,review:q}};function f(){return i.use(x).init({resources:r,lng:"en",fallbackLng:"en"})}';
    const f = path.join(dir, 'overrides.js');
    fs.writeFileSync(f, source);
    patch(f, '{"a":"打开","b":"搜索"}', '{}', { exclude: ['Open'], customTranslations: { Open: '开启', Search: '查找' } });
    const result = vm.runInNewContext(fs.readFileSync(f, 'utf8') + '; f()');
    assert.strictEqual(result.resources.zh.translation.a, 'Open');
    assert.strictEqual(result.resources.zh.translation.b, '查找');
    assert.ok(restore(f));
    assert.strictEqual(fs.readFileSync(f, 'utf8'), source);
  });
  t('DOM-only 降级仍能校验备份并还原', () => {
    const f = path.join(dir, 'dom-only.js'), src = 'var newLayout=true;';
    fs.writeFileSync(f, src);
    assert.strictEqual(patch(f, zh1).reason, 'init-site-not-found');
    applyDom(f, { Search: '搜索' });
    assert.strictEqual(patch(f, zh1).reason, 'init-site-not-found');
    assert.strictEqual(applyDom(f, { Search: '搜索' }).applied, false);
    assert.ok(restore(f));
    assert.strictEqual(fs.readFileSync(f, 'utf8'), src);
  });
  t('命名占位符规则在 i18next 与 DOM 两层一致', () => {
    const { overlayCatalog, domRules } = require('../lib/rules');
    const en = { label: 'Type "{{word}}" to confirm' }, zh = { label: '请输入“{{word}}”以确认' };
    const rules = { exclude: ['Type "{{word}}" to confirm'] };
    assert.strictEqual(overlayCatalog(en, zh, rules).label, en.label);
    assert.strictEqual(domRules({}, rules)['Type "{0}" to confirm'], 'Type "{0}" to confirm');
    assert.strictEqual(overlayCatalog(en, zh, { customTranslations: { 'Type "{0}" to confirm': '键入 {0}' } }).label, '键入 {{word}}');
  });
  console.log(`\n${n} passed`);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
