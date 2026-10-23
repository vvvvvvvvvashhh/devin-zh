const path = require('path');
const df = require('./devin-files');
function parse(args, launching = false) {
  const options = {}, forward = [];
  const names = { '--app-dir': 'appDir', '--user-data-dir': 'userDataDir', '--extensions-dir': 'extensionsDir' };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i], eq = arg.indexOf('='), flag = eq > 0 ? arg.slice(0, eq) : arg;
    if (names[flag]) {
      const value = eq > 0 ? arg.slice(eq + 1) : args[++i];
      if (!value || value.startsWith('--')) throw new Error(flag + ' 需要目录参数');
      options[names[flag]] = path.resolve(value);
      if (launching && flag !== '--app-dir') forward.push(flag, path.resolve(value));
    } else if (arg === '--help' || arg === '-h') options.help = true;
    else if (!launching && arg === '--restore') options.restore = true;
    else if (launching) forward.push(arg);
    else throw new Error('未知参数：' + arg);
  }
  if (options.help) return { options, forward };
  if (!options.userDataDir && process.env.DEVIN_USER_DATA_DIR) {
    options.userDataDir = path.resolve(process.env.DEVIN_USER_DATA_DIR);
    if (launching) forward.push('--user-data-dir', options.userDataDir);
  }
  if (!options.extensionsDir && process.env.DEVIN_EXTENSIONS_DIR) {
    options.extensionsDir = path.resolve(process.env.DEVIN_EXTENSIONS_DIR);
    if (launching) forward.push('--extensions-dir', options.extensionsDir);
  }
  if (options.userDataDir && !options.extensionsDir) throw new Error('使用自定义 user-data-dir 时也必须指定 extensions-dir，以免修改默认安装的语言包');
  options.appDir = df.appDir(options.appDir);
  options.userDataDir = df.userDataDir(options.userDataDir);
  return { options, forward };
}
module.exports = { parse };
