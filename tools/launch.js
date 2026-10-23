const fs = require('fs'), path = require('path');
const { spawn, execFileSync } = require('child_process');
const { parse } = require('../lib/cli-options');
const workflow = require('../lib/workflow');
function devinRunning() {
  try {
    if (process.platform === 'win32') return /Devin\.exe/i.test(execFileSync('tasklist', ['/FI', 'IMAGENAME eq Devin.exe', '/NH'], { encoding: 'utf8' }));
    execFileSync('pgrep', ['-x', 'Devin']); return true;
  } catch (e) {
    if (process.platform !== 'win32' && e.status === 1) return false;
    throw new Error('无法确认 Devin 是否已退出，未执行补丁：' + e.message);
  }
}
function executable(app) {
  const install = path.resolve(app, '..', '..');
  const choices = process.platform === 'win32' ? [path.join(install, 'Devin.exe')]
    : process.platform === 'darwin' ? [path.join(install, 'MacOS/Devin')]
      : [path.join(install, 'devin'), path.join(install, 'Devin')];
  const exe = choices.find(file => fs.existsSync(file));
  if (!exe) throw new Error('指定安装目录中未找到 Devin 可执行文件');
  return exe;
}
function launch(args) {
  const { options, forward } = parse(args, true);
  if (options.help) {
    console.log('node tools/launch.js [--app-dir DIR] [--user-data-dir DIR --extensions-dir DIR] [Devin 参数...]');
    return;
  }
  const exe = executable(options.appDir);
  if (devinRunning()) console.log('Devin 已在运行，跳过补丁');
  else console.log(JSON.stringify(workflow.run({ ...options, manual: false })));
  const child = spawn(exe, forward, { detached: true, stdio: 'ignore' });
  child.on('error', e => { console.error('启动 Devin 失败：' + e.message); process.exitCode = 1; });
  child.unref();
}
if (require.main === module) {
  try { launch(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { launch, executable };
