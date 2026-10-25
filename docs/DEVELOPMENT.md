# Development · 开发指南

[English README](../README.md) · [中文说明](../README.zh-CN.md)

## Build · 构建

The dashboard build requires **Node.js 22.12+ and npm**. Companion development additionally requires Windows and a compatible .NET SDK; see the [companion build guide](COMPANION.md#build).

桌面扩展构建需要 **Node.js 22.12+ 和 npm**。Windows 桌面助手的开发环境与工具要求，见[构建指南](COMPANION.md#build)。

```sh
git clone https://github.com/MelonPika/PikaSpace.git
cd PikaSpace
npm ci
npm run dev
```

The dev server is a web preview. To use extension integrations, run `npm run build` and load `dist/` in Chrome.
开发服务器用于网页预览；需要测试扩展集成时，运行 `npm run build`，然后在 Chrome 中加载 `dist/`。

| Command | Purpose · 用途 |
| --- | --- |
| `npm run dev` | Start the web preview · 启动网页预览 |
| `npm run build` | Generate notices and build `dist/` · 生成依赖声明并构建扩展 |
| `npm run lint` | Check syntax, JSON, and production hazards · 检查语法、JSON 与生产代码风险 |
| `npm run typecheck` | Check active TypeScript code · 检查当前运行代码的类型 |
| `npm test` | Run regression tests, type checks, build, and extension validation · 回归测试、类型检查、构建与扩展验证 |
| `npm run test:browser` | Exercise real extension/media APIs in disposable Chromium profiles · 使用独立配置测试真实扩展与媒体 API |
| `npm run package` | Lint, test, and create portable / store-layout ZIPs · 检查、测试并生成便携包与商店格式包 |
| `npm run clean` | Remove generated build/test folders and Vite caches · 清理构建、验证目录与 Vite 缓存 |
| `npm run package:companion` | Build the optional Windows installer · 构建可选的 Windows 安装程序 |
| `npm run test:companion` | Test detection, install, pairing, upgrade, and uninstall in isolation · 独立测试检测、安装、配对、升级与卸载 |

Browser tests use real extension/media APIs and explicit fixtures for external services. Set `CHROME_PATH` when Chrome is installed elsewhere; reports and screenshots go to `.verification/`. Browser checks run separately from `npm run package` and are required for release acceptance. Companion and cleanup scripts use Windows PowerShell.

浏览器测试使用真实的扩展、媒体 API，以及明确的外部服务测试数据。Chrome 安装位置不同时可设置 `CHROME_PATH`；报告和截图保存在 `.verification/`。发布验收还需要单独运行浏览器测试。助手与清理脚本使用 Windows PowerShell。

## Package output · 打包产物

`npm run package` creates the following files locally. Generated releases are ignored by Git; building does not publish a release.

运行 `npm run package` 后会在本地生成以下内容；产物不纳入 Git，构建过程不会自动发布。

```text
releases/
├── PikaDesk-1.0.1/extension/
├── PikaDesk-1.0.1.zip
└── PikaDesk-1.0.1-chrome-web-store.zip
```

The store-layout ZIP puts `manifest.json` at its root for publisher review; it does not indicate store publication. The companion is packaged separately under `releases/companion/`.

商店格式 ZIP 将 `manifest.json` 放在根目录，供发布者准备提审，不代表已上架。桌面助手单独生成在 `releases/companion/`。

## Project map · 项目结构

| Path | Contents · 内容 |
| --- | --- |
| `src/` | Active dashboard UI, styles, and storage · 当前桌面界面、样式与存储 |
| `public/` | Manifest, background worker, media connector, and icons · 扩展清单、后台、媒体连接与图标 |
| `companion/` | Native host, installer, scripts, and diagnostic extension · 原生主机、安装程序、脚本与诊断扩展 |
| `scripts/` | Build, validation, packaging, and cleanup · 构建、验证、打包与清理 |
| `tests/` | Dashboard, media, storage, browser, and installer tests · 桌面、媒体、存储、浏览器与安装测试 |
| `docs/` | Installation, privacy, release, and companion guides · 安装、隐私、版本与助手文档 |
| `docs/assets/` | Real product screenshots and capture notes · 实机截图与拍摄说明 |
| `docs/archive/` | Historical source and verification evidence · 历史源码与验证记录 |
| `future-features/calendar/` | Disabled Calendar source preserved for future work · 保留的日历源码，当前未启用 |
| `releases/` | Generated extension packages and companion installers · 生成的扩展包与助手安装程序 |

`node_modules/`, `dist/`, `.verification/`, and `.cache/` are local dependency or generated folders. Cleanup keeps dependencies, historical archives, and every release version. To also remove cached installer tools, run:

以下命令会额外清理下载的安装工具缓存；普通清理会保留依赖、历史归档和所有版本的发布产物。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/clean.ps1 -ToolCache
```

<a id="more-docs"></a>

## Further reading · 更多文档

| Guide | Details · 内容 |
| --- | --- |
| [Installation & media](INSTALL.md) | Updates, backups, moving settings, and browser media · 更新、备份、迁移与浏览器音乐 |
| [Privacy](PRIVACY.md) | Storage, permissions, and external data flows · 存储、权限与外部服务数据流 |
| [Companion](COMPANION.md) / [Native protocol](../companion/README.md) | Installer, packaging, detection, and native messaging · 安装、打包、检测与原生消息 |
| [Release notes](RELEASE-NOTES.md) / [Store preparation](STORE-PREPARATION.md) | Version changes and publisher checklist · 版本变化与发布准备 |
| [Historical audit](RELEASE-AUDIT-1.0.md) / [Archives](archive/README.md) | Previous release checks and preserved evidence · 历史验收与保留记录 |
| [Calendar source](../future-features/calendar/README.md) | Deferred implementation and compatibility notes · 暂缓的实现与兼容说明 |
