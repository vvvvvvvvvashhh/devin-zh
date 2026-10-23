# 源码与发布

## 上传源码

仓库根目录保留扩展代码、`lib/`、`tools/`、`translations/`、`devin-zh.cmd`、npm 清单和锁文件、许可和文档，以及 Git/VSIX 的忽略配置。

必须保留这些词典资料：

- `catalogs/zh.translation.json`、`catalogs/zh.review.json`、`catalogs/dom-dict.json`、`main.i18n.json`：已构建的运行时产物。
- `legacy-main.i18n.json`：旧版补丁的迁移校验资料。
- `built-in.json`、`api-zh.json`、`workbench-zh.json`、`corrections.json`：构建、补词和人工校正来源。

`node_modules/`、VSIX、日志、`tools/scratch/`、内部交接笔记，以及抽取出的英文原文和待翻译中间文件不提交。Git 会按 `.gitignore` 排除；网页上传时也应跳过本地 `.git/` 元数据，保留三个点开头的 Git/VSIX 配置文件。

源码 ZIP 供源码分发或解压后网页上传。把 ZIP 直接上传到仓库不会自动展开为源码。

## 从干净源码打包

要求 Node.js 22+，以及测试用的 Chrome/Edge。Windows 使用系统 bsdtar；macOS 使用系统 tar，Linux 需安装 bsdtar。

```sh
npm ci
npm test
npm run pack
```

以上流程使用仓库已有的中文产物，不要求预先抽取本机 Devin。输出文件名由 name/version 决定，例如 `devin-zh-0.1.8.vsix`。

**必须使用包含运行时依赖的 VSIX。** 推荐 `npm run pack`，它会在独立暂存目录检查 acorn、词典、启动器并实际加载运行时。不要使用 `vsce package --no-dependencies`。

## 更新词典

只调整 DOM 显示层时，可修改人工词典后运行：

```sh
npm run build:dict
```

完整重建 i18next、DOM 和 NLS 前，需要先从目标版本的本机安装抽取英文源资料：

```sh
node tools/extract.js
node tools/extract-catalog.js
npm run build
```

生成的英文中间文件只留在开发机器，不加入源码仓库。需要补充机器译文时，按 README 配置接口，再显式运行翻译工具；普通打包不调用翻译 API。

## 发布

更新功能时同步维护版本号、锁文件与 CHANGELOG。源码通过 Git 仓库发布，VSIX 作为 Release 附件或扩展平台安装包发布，并注明实际验证的 Devin 版本和系统。

`npm run patch`、`npm run restore` 和启动器会操作本机安装，不能把它们当作构建步骤或自动 CI 验证命令。
