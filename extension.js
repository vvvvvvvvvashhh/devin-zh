const vscode = require('vscode');
const path = require('path');
const workflow = require('./lib/workflow');
let status;

function options(context) {
  const pack = vscode.extensions.getExtension('ms-ceintl.vscode-language-pack-zh-hans');
  return {
    extensionPath: context.extensionPath,
    appDir: vscode.env.appRoot,
    userDataDir: workflow.userDataFromStorage(context.globalStorageUri.fsPath),
    officialPack: pack ? path.join(pack.extensionPath, 'translations/main.i18n.json') : null,
  };
}
function syncSettings(context) {
  const opts = options(context), cfg = vscode.workspace.getConfiguration('devinZh');
  workflow.savePolicy(opts.userDataDir, {
    autoApply: cfg.get('autoApply') !== false,
    customTranslations: cfg.get('customTranslations') || {},
    exclude: cfg.get('exclude') || [],
  });
  return opts;
}
async function execute(context, restore, manual) {
  try {
    const opts = syncSettings(context);
    const result = workflow.run({ ...opts, restore, manual });
    if (result.paused && !restore) { status.text = '$(globe) Devin汉化(已暂停)'; return; }
    status.text = restore ? '$(globe) Devin汉化(已还原/暂停)' : '$(globe) Devin汉化 ✓';
    if (result.warnings.length) {
      status.text = '$(globe) Devin汉化 ⚠';
      vscode.window.showWarningMessage(result.warnings.join('；'));
    }
    if (restore || result.changed || manual) vscode.window.showInformationMessage(restore
      ? '已还原并暂停自动汉化（启动器也会保持英文）；请完全退出 Devin 再打开。手动应用可重新开启'
      : result.changed ? `已更新 ${result.changed} 处；请完全退出 Devin 再打开生效`
        : '补丁内容与当前词典一致，无需修改');
  } catch (e) {
    status.text = '$(globe) Devin汉化 ✗';
    vscode.window.showErrorMessage('汉化操作未完成：' + e.message);
  }
}
async function activate(context) {
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.command = 'devin-zh.apply';
  status.text = '$(globe) Devin汉化';
  status.tooltip = '应用/重试 Devin 界面汉化';
  status.show();
  context.subscriptions.push(status,
    vscode.commands.registerCommand('devin-zh.apply', () => execute(context, false, true)),
    vscode.commands.registerCommand('devin-zh.restore', () => execute(context, true, true)),
    vscode.commands.registerCommand('devin-zh.openRules', async () => {
      const doc = await vscode.workspace.openTextDocument(path.join(context.extensionPath, 'translations/catalogs/dom-dict.json'));
      await vscode.window.showTextDocument(doc);
    }));
  try {
    const opts = syncSettings(context);
    const cfg = workflow.policy(opts.userDataDir);
    if (cfg.paused) status.text = '$(globe) Devin汉化(已暂停)';
    else if (cfg.autoApply !== false) {
      const timer = setTimeout(() => execute(context, false, false), 4000);
      context.subscriptions.push({ dispose: () => clearTimeout(timer) });
    }
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('devinZh')) {
        try { syncSettings(context); } catch (e) { vscode.window.showErrorMessage(e.message); }
      }
    }));
  } catch (e) {
    status.text = '$(globe) Devin汉化 ✗';
    vscode.window.showErrorMessage('无法定位当前 Devin 安装或配置：' + e.message);
  }
}
function deactivate() {}
module.exports = { activate, deactivate };
