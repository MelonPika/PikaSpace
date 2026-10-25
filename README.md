
# PikaDesk · 皮卡桌面

**Your Browser, Your Workspace.**

[Source code](https://github.com/MelonPika/PikaSpace) · [Releases](https://github.com/MelonPika/PikaSpace/releases) · [Help and issues](https://github.com/MelonPika/PikaSpace/issues)

A customizable Chrome new-tab dashboard with widgets, shortcuts, music controls, and a personalized workspace. Built as a Chrome Manifest V3 extension.

## Project folders

| Folder | Contents |
| --- | --- |
| `src/` | Active dashboard UI, CSS, and local storage |
| `public/` | Extension manifest, background worker, media connector, and icons |
| `companion/` | Windows native host, EXE installer, scripts, and diagnostic extension |
| `scripts/` | Build, validation, packaging, and cleanup tools |
| `tests/` | Dashboard, browser, native-protocol, and installer checks |
| `docs/` | Installation, privacy, release, and companion documentation |
| `docs/archive/` | Historical source snapshot and verification evidence |
| `future-features/calendar/` | Preserved, disabled Calendar implementation |
| `releases/` | Existing versioned extension packages and companion installers |

`node_modules/` contains installed development dependencies. Build output (`dist/`), verification output (`.verification/`), and tool downloads (`.cache/`) are generated and ignored by Git.

## Install a release

Extract `releases/PikaDesk-1.0.1.zip`, open `chrome://extensions`, enable Developer mode, click **Load unpacked**, and choose the extracted `PikaDesk-1.0.1/extension` folder. Keep that folder in place. No Node.js, local server, or companion app is needed for installation.

The rebrand retains the existing manifest key and stable extension ID, so updating an existing stable-ID installation keeps its settings. Storage keys, backup format, and companion protocol remain compatible. Older release artifacts and historical audit evidence keep their original filenames. The repository is intentionally named **PikaSpace**.

Version 1.0.1 introduces a stable ID for portable releases. Before switching from 1.0.0 or 0.2.0, export **Settings > Data & Backup > Export settings** in the old extension, load the new version, and import the backup. Chrome stores data by extension ID. You may keep your existing extension and simply install the updated companion; it detects older unpacked copies automatically.

See [installation and media support](docs/INSTALL.md) for updates, moving settings, browser media access, and optional integrations.

## Media connector

The Music widget works independently of the companion for accessible HTML audio/video playing in Chrome tabs. Click **Enable browser media** to grant optional site access. It reads the page's Media Session metadata where available, supports play/pause, and detects previous/next buttons on supported web players. Browser sessions take priority; desktop media falls back to the optional Windows native host.

Windows desktop media and system stats still require the companion. The older extension in `companion/diagnostics-extension` is a native-host diagnostic tool and still requires it; it is not the portable dashboard release.

## Build and package

Requires Node.js 22.12+ and npm.

```sh
npm ci
npm run package
```

Packaging runs regression, type, build, and manifest checks and creates a ready-to-load folder, a portable ZIP, and a separate Chrome Web Store ZIP with the manifest at its root. The release contains built runtime files and documentation, with no source, native binaries, dependencies, or personal settings. `npm run build` creates `dist/`; `npm run dev` starts the web preview (extension integrations require loading it in Chrome).

Run `npm run lint` for syntax/JSON/production hazard checks, `npm run typecheck` for active-runtime TypeScript checks, and `npm run test:browser` for disposable-profile Chromium checks. Set `CHROME_PATH` when needed. Browser checks use real extension/media APIs and explicit fixtures for external services; evidence goes to `.verification/`. They run separately and must pass for release acceptance. Unused prototype screens and styles are preserved in the [historical source archive](docs/archive/README.md).

Run `npm run clean` to remove generated build/test folders and Vite caches. It keeps installed dependencies, cached installer tools, source, archives, and every release version. To also clear downloaded installer tools, run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/clean.ps1 -ToolCache`.

Calendar is postponed to a future version. Original source is preserved under `future-features/calendar`, dormant event data is retained, and Calendar is absent from the 1.0 runtime. See [privacy](docs/PRIVACY.md), [release notes](docs/RELEASE-NOTES.md), [store preparation](docs/STORE-PREPARATION.md), and the [release audit](docs/RELEASE-AUDIT-1.0.md). Nothing is published automatically.

## Companion development

Users can run `releases/companion/PikaDesk-Companion-0.2.1-Setup-x64.exe` to install the optional Windows helper. It includes its runtime, needs no administrator access or commands, and runs only when Chrome requests it. Choose **Connect automatically**: Setup detects existing PikaDesk · 皮卡桌面 copies in Chrome and already knows the stable portable-release ID. Manual entry is available for unusual profiles. The companion is distributed separately from the dashboard ZIP.

Run `npm run package:companion` to build the installer, or see [companion packaging and verification](docs/COMPANION.md) for preconfigured extension IDs, updates, and tests. See [the Windows native companion](companion/README.md) for the protocol and developer tools.

The original dashboard design is available [on Figma](https://www.figma.com/design/yCDgbKZjXOC3yYOOVFB6Uu/Customizable-New-Tab-Dashboard).
