const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert'), vm = require('vm');
const wf = require('../lib/workflow'), df = require('../lib/devin-files'), { sha } = require('../lib/files');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'devin-zh-workflow-'));
const bundle = 'var T={manageAccess:{accessLevel:"Access level"}},q={},x={},i={use(){return this},init(o){return o}};let r={en:{translation:T,review:q}};function f(){return i.use(x).init({resources:r,lng:"en",fallbackLng:"en"})}';
let count = 0;
const test = (name, fn) => { fn(); count++; console.log('ok', name); };
function install(name) {
  const app = path.join(dir, name, 'app'), user = path.join(dir, name, 'user');
  const write = (f, text) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); };
  for (const target of df.TARGETS) write(df.target(target, app), bundle);
  write(path.join(app, 'out/unrelated.js'), 'unrelated changed file');
  write(path.join(app, 'product.json'), JSON.stringify({ nameShort: 'Devin', checksums: {
    ...Object.fromEntries(df.TARGETS.map(t => [t, df.sha256b64(Buffer.from(bundle))])),
    'unrelated.js': 'original-checksum-must-stay',
  } }));
  write(path.join(app, 'out/nls.metadata.json'), JSON.stringify({ keys: { 'vs/sessions/demo': ['access'] },
    messages: { 'vs/sessions/demo': ['Access level'] } }));
  return { appDir: app, userDataDir: user, officialPack: null, manual: true };
}
function snapshot(app) {
  const out = {};
  function walk(d) {
    for (const item of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, item.name);
      if (item.isDirectory()) walk(p);
      else out[path.relative(app, p)] = sha(fs.readFileSync(p));
    }
  }
  walk(app); return out;
}
try {
  test('提交第二个 bundle 失败时回滚全部文件、备份、状态和校验和', () => {
    const opts = install('rollback'), before = snapshot(opts.appDir), rename = fs.renameSync;
    let triggered = false;
    fs.renameSync = function (from, to) {
      if (!triggered && to === df.target(df.TARGETS[1], opts.appDir)) { triggered = true; throw new Error('simulated EACCES second bundle'); }
      return rename.apply(this, arguments);
    };
    try { assert.throws(() => wf.run(opts), /EACCES/); } finally { fs.renameSync = rename; }
    assert.ok(triggered);
    assert.deepStrictEqual(snapshot(opts.appDir), before);
  });
  test('product.json 写入失败不得提交或伪装成功', () => {
    const opts = install('checksum-failure'), before = snapshot(opts.appDir), write = fs.writeFileSync;
    let triggered = false;
    fs.writeFileSync = function (file) {
      if (String(file).startsWith(path.join(opts.appDir, 'product.json.tmp-'))) { triggered = true; throw new Error('simulated EACCES product.json'); }
      return write.apply(this, arguments);
    };
    try { assert.throws(() => wf.run(opts), /EACCES/); } finally { fs.writeFileSync = write; }
    assert.ok(triggered);
    assert.deepStrictEqual(snapshot(opts.appDir), before);
  });
  test('缺少第二个目标时不改第一个目标', () => {
    const opts = install('missing');
    fs.unlinkSync(df.target(df.TARGETS[1], opts.appDir));
    const before = snapshot(opts.appDir);
    assert.throws(() => wf.run(opts), /缺少 bundle/);
    assert.deepStrictEqual(snapshot(opts.appDir), before);
  });
  test('还原后自动扩展/启动器保持英文，手动应用才解除暂停', () => {
    const opts = install('pause');
    assert.strictEqual(wf.run(opts).changed, 2);
    assert.strictEqual(wf.run({ ...opts, restore: true }).changed, 2);
    assert.ok(wf.run({ ...opts, manual: false }).paused);
    for (const target of df.TARGETS) assert.strictEqual(fs.readFileSync(df.target(target, opts.appDir), 'utf8'), bundle);
    assert.strictEqual(wf.run(opts).changed, 2);
    assert.strictEqual(wf.policy(opts.userDataDir).paused, false);
  });
  test('相同补丁幂等，无关校验和不变', () => {
    const opts = install('checksums');
    wf.run(opts);
    const before = snapshot(opts.appDir);
    assert.strictEqual(wf.run(opts).changed, 0);
    assert.deepStrictEqual(snapshot(opts.appDir), before);
    const product = JSON.parse(fs.readFileSync(path.join(opts.appDir, 'product.json'), 'utf8'));
    assert.strictEqual(product.checksums['unrelated.js'], 'original-checksum-must-stay');
    for (const target of df.TARGETS) assert.strictEqual(product.checksums[target], df.sha256b64(fs.readFileSync(df.target(target, opts.appDir))));
  });
  test('启动器自动路径使用持久化的排除规则', () => {
    const opts = install('rules');
    wf.savePolicy(opts.userDataDir, { exclude: ['Access level'], customTranslations: { Search: '查找' } });
    wf.run({ ...opts, manual: false });
    const context = {};
    vm.runInNewContext(fs.readFileSync(df.target(df.TARGETS[0], opts.appDir), 'utf8'), context);
    assert.strictEqual(vm.runInNewContext('f().resources.zh.translation.manageAccess.accessLevel', context), 'Access level');
  });
  test('用户数据路径取自当前普通/命名 profile，不回落默认目录', () => {
    const base = path.join(dir, 'isolated');
    assert.strictEqual(wf.userDataFromStorage(path.join(base, 'User/globalStorage/publisher.extension')), base);
    assert.strictEqual(wf.userDataFromStorage(path.join(base, 'User/profiles/profile-id/globalStorage/publisher.extension')), base);
    assert.throws(() => wf.userDataFromStorage(path.join(base, 'unknown')), /无法定位/);
  });
  console.log(`${count} passed`);
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
