# devin-zh

Devin Desktop 简体中文界面扩展。非官方项目，与 Cognition 无关。

> 这是本地补丁：它会修改 Devin 安装目录里的前端文件和官方中文语言包，原文件备份在旁边的 `.en-backup`，随时可以还原。

## 安装

1. 先装官方中文语言包 `MS-CEINTL.vscode-language-pack-zh-hans`，把显示语言设成 `zh-cn`。
2. 命令面板执行 **Extensions: Install from VSIX...**，选 `devin-zh-0.1.9.vsix`。
3. 补丁打完后，**完全退出 Devin 再重新打开**。只刷新窗口的话，可能会看到"安装已损坏"的提示，因为补丁是在 Devin 运行时改的文件和校验和。

需要对 Devin 安装目录和官方中文语言包有写权限。扩展只改当前这个 Devin 自己的安装、语言包和用户数据目录，不会去找其他编辑器的语言包。

**从 0.1.4 升级**：可以直接装新版。0.1.4 没记录语言包状态，升级时会用原备份重新算出旧版合并后应有的内容，再逐项比对当前文件。只是缩进、末尾换行或键的顺序不同不影响；内容真有出入就停下，不改文件。备份丢了，或者文件被别的程序改过，也一样停下，不会拿旧版本去覆盖。

## 原理

三层叠加，任何一层失效都不会让整个界面变回英文：

| 层 | 做什么 |
|---|---|
| i18next | 往 Devin 两个前端 bundle 里注入中文目录，没翻的条目显示英文 |
| DOM 显示层 | 翻译界面上的文字和提示属性；聊天、Markdown、代码、终端和输入框都跳过 |
| 语言包 | 把 Devin 自己的界面文字合并进官方中文语言包 |

显示层的边界：

- 相邻的纯文本可以拼起来整句翻译。一句话被链接、代码、加粗这类元素隔开时，其中一部分可能还是英文。
- 不会为了整句匹配去清空子元素。
- 文字被移进聊天、代码这些区域时，本层改过的会还原。
- Devin 改了容器命名或布局后，可能需要适配。

改文件时，目标文件、备份、状态、语言包和校验和都先在临时目录准备好，再一起写进去。中途失败会回滚，并告诉你回滚是否完整。`product.json` 只重算改动过的文件的校验和。不要手动拿旧的 `product.json` 备份覆盖新版 Devin。

## 命令

| 命令 | 作用 |
|---|---|
| Devin 汉化: 应用汉化 | 手动打上最新补丁，同时取消暂停 |
| Devin 汉化: 还原原版 | 核对备份后恢复英文，并暂停扩展和启动器的自动汉化 |
| Devin 汉化: 打开翻译词典 | 查看当前的显示层词典 |

## 恢复英文

执行"还原原版"，然后完全退出 Devin 再打开，就会一直保持英文。想重新用汉化，再执行一次"应用汉化"。

只卸载或禁用本扩展，不会撤销已经写进磁盘的补丁。不想用了，请先还原，再卸载。

提示"备份/状态不匹配"时，不要硬拿来历不明的备份去覆盖。重装对应的 Devin 或官方语言包，再应用补丁。还原失败时，自动汉化保持暂停。

## 自定义词条

| 设置 | 说明 |
|---|---|
| `devinZh.customTranslations` | 自定义词条，`{"英文原文": "中文"}` |
| `devinZh.exclude` | 保持英文的原文列表，和自定义词条冲突时以它为准 |
| `devinZh.autoApply` | 设为 `false` 后，扩展和启动器都不会自动打补丁；手动应用不受影响 |

- 三层都会用这些规则。原文里的 `{0}`、`{{name}}` 这类占位符要原样保留，两种写法会自动对应。
- 这些设置针对整个 Devin 安装，不区分工作区。改完后手动应用一次，再完全重启。
- 规则和暂停状态存在用户数据目录的 `devin-zh.json` 里，启动器也读这一份。
- 普通用户请用这几个设置改词。直接改扩展里的 JSON，扩展一升级就会被覆盖。

## 启动器（可选）

VSIX 里带了 `devin-zh.cmd`、`tools/launch.js` 和命令行补丁工具。启动器需要另装 **Node.js 22+**，只用 VSIX 的话不需要。

在扩展的安装目录（或源码仓库根目录）运行 `devin-zh.cmd`：

- Devin 没在运行：先打补丁，再启动 Devin。这样不会在运行中改校验和，也就不会出现"安装已损坏"提示。
- Devin 已在运行：只打开窗口，不打补丁。
- 判断不了 Devin 是否在运行，或者补丁失败：直接报错，不会假装成功。

扩展升级后安装目录会带上新版本号。如果你给 `devin-zh.cmd` 建了快捷方式，记得更新目标路径。

只装了一份 Devin 时会自动找到它。装了多份或用便携版，就手动指定路径：

```cmd
set APP=D:\Apps\Devin\resources\app
set DATA=D:\DevinProfile
set EXT=D:\DevinExtensions

node tools/launch.js --app-dir "%APP%" --user-data-dir "%DATA%" --extensions-dir "%EXT%"
node tools/patch-devin.js --app-dir "%APP%" --user-data-dir "%DATA%" --extensions-dir "%EXT%"
node tools/patch-devin.js --restore --app-dir "%APP%" --user-data-dir "%DATA%" --extensions-dir "%EXT%"
```

也可以改用环境变量 `DEVIN_APP_DIR`、`DEVIN_USER_DATA_DIR`、`DEVIN_EXTENSIONS_DIR`。

- 自定义了用户数据目录，就必须同时指定扩展目录，不然会改到默认安装的语言包。
- 启动器会把这两个目录参数一并传给 Devin。

## 开发

```cmd
npm ci
npm test
npm run pack
```

- 运行时唯一依赖是 acorn 8.19.0。测试和源码工具要用 Node.js 22+。
- DOM 测试要用本机的 Chrome 或 Edge，可以用 `CHROME_PATH` 指定。
- 打包用 `npm run pack`：先在独立目录检查必需文件、试加载依赖，再生成 VSIX。Windows 用系统自带的 bsdtar，其他系统需要装支持 ZIP 的 bsdtar。
- **不要用 `vsce package --no-dependencies`**：acorn 没打进单个 JS 文件，少了它扩展装上后无法激活。
- 上传源码、打安装包和发布前检查，见 [RELEASING.md](RELEASING.md)。

仓库里带着构建需要的中文产物、人工校正和翻译缓存，克隆后直接 `npm ci` 就能测试和打包。

**只改译文**

编辑下面任意一处，再运行 `npm run build:dict`：

- `translations/corrections.json`
- `translations/workbench-zh.json`
- `tools/build-dom-dict.js` 里的 `seeds`

这样只更新显示层。要让 i18next 和语言包也跟着改，需要走下面的完整重建。

### 完整重建

在装有目标版本 Devin 的机器上：

```cmd
node tools/extract.js
node tools/extract-catalog.js
node tools/extract-workbench.js
node tools/translate-batch.js 6
node tools/translate-batch.js 6 todo-workbench.json
npm run build
npm test
npm run pack
```

- 抽取工具只读 Devin 的文件，不改它。`extract-catalog.js` 不带参数时会自动找 sessions bundle，也可以手动传文件路径；输出的文件名固定为 `en.translation.json` 和 `en.review.json`。
- 英文原文版权归 Devin，不进 Git 也不进 VSIX。仓库只留中文产物和翻译缓存，已经翻过的条目不会重复调用接口。
- 人工校正优先于机翻。`node tools/apply-corrections.js` 会把校正写回缓存。
- `npm run build` 重建三层，并检查键名、占位符和关键的确认文案。
- `legacy-main.i18n.json` 只用来核对 0.1.4 升级时的备份，不会用来翻译新界面。

机翻优先读环境变量：`ANTHROPIC_AUTH_TOKEN` 或 `ANTHROPIC_API_KEY`、`ANTHROPIC_BASE_URL`、`DEVIN_ZH_MODEL` 或 `ANTHROPIC_MODEL`。没设时读 `~/.claude/settings.json` 的 `env` 段，密钥不会写进仓库。接口返回的 JSON 不完整、缺条目或占位符对不上时，会报错重试；最后还有没翻完的，进程以非零状态退出。

## 验证范围与限制

在 Windows、Devin Desktop 1.126.0（commit `0b186d6`）上验证过：补丁、升级迁移、语言包合并、校验和、还原，以及浏览器里的 DOM 回归测试；也实际重启检查过主界面、侧边栏和设置浮层。

还没验证的：完整的模型交互流程、macOS 和 Linux，以及远程 SSH、WSL、容器。扩展运行在本地 UI 宿主，只修改本机的 Desktop 安装。

其他限制：

- 远端 `app.devin.ai` 页面翻译不到。
- Devin 改了 i18next 初始化结构时，扩展会明确提示降级，只应用还能用的层。
- 多个窗口同时打补丁时有锁保护。程序异常退出留下的锁，要等确认原进程已退出才会自动清理。

各版本修了什么，见 [CHANGELOG.md](CHANGELOG.md)。

## 许可

MIT © N1n3VASthR33H，只覆盖本项目的代码和中文译文。

词典里的英文原文版权归原权利人，仅作翻译对照。Devin 是 Cognition 的商标。修改安装文件可能不符合其使用条款，使用前请自行确认。
