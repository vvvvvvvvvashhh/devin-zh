// All paths can be supplied explicitly; never mix an isolated user-data dir
// with the default installation's language pack.
const { parse } = require('../lib/cli-options');
const workflow = require('../lib/workflow');
try {
  const { options } = parse(process.argv.slice(2));
  if (options.help) console.log('node tools/patch-devin.js [--restore] [--app-dir DIR] [--user-data-dir DIR --extensions-dir DIR]');
  else {
    const result = workflow.run({ ...options, manual: true });
    console.log(JSON.stringify(result, null, 2));
    console.log(options.restore ? '已暂停自动汉化；完全退出并重启 Devin 生效' : '完全退出并重启 Devin 生效');
  }
} catch (e) { console.error(e.message); process.exitCode = 1; }
