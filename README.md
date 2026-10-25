<a id="top"></a>

<div align="center">
  <img src="docs/assets/mascot-256.png" alt="PikaDesk mascot" width="140" />
  <h1>PikaDesk · 皮卡桌面</h1>
  <p><strong>Your Browser, Your Workspace.</strong></p>
  <p>
    <kbd>Chrome · Manifest V3</kbd>
    <kbd>Widgets &amp; shortcuts</kbd>
    <kbd>Optional Windows companion</kbd>
  </p>
  <p><strong>English</strong> · <a href="README.zh-CN.md">简体中文</a></p>
  <p>
    <a href="#installation">Installation</a> ·
    <a href="#quick-start">Quick start</a> ·
    <a href="#features">Features</a> ·
    <a href="#troubleshooting">Help</a>
  </p>
</div>

A customizable Chrome new-tab dashboard with widgets, shortcuts, music controls, and a personalized workspace.

<details>
<summary>🖼️ Preview</summary>

![PikaDesk dashboard with search, favorites, clock, notes, and tasks](docs/assets/dashboard.webp)

Actual extension capture with example notes and tasks. [View Chinese appearance settings](docs/assets/settings-zh.webp).

</details>

---

<a id="installation"></a>

## 📦 Installation

**Using a packaged build requires no Node.js, npm, local server, or Windows companion.**

A packaged download has not yet been published on [GitHub Releases](https://github.com/MelonPika/PikaSpace/releases). If you have a supplied `PikaDesk-1.0.1.zip`, follow these steps. If you have the source code, [build it first](#development).

1. Extract the ZIP into a permanent folder.
2. Open `chrome://extensions/` in desktop Chrome.
3. Turn on **Developer mode** and click **Load unpacked**.
4. Select **`PikaDesk-1.0.1/extension`**, the folder containing `manifest.json`.
5. Open a new tab and accept Chrome's new-tab change if prompted.

Keep the extracted folder in place. GitHub's **Code → Download ZIP** downloads source code, which needs a build step. There is no published Chrome Web Store listing; Windows desktop Chrome is the primary verified target.

See the [installation guide](docs/INSTALL.md) for the package structure and migration instructions.

<a id="quick-start"></a>

## 🚀 Quick start

1. Open a new tab and click the **Settings** gear.
2. In **Appearance** and **Wallpaper**, choose a theme, accent color, and background.
3. In **Widgets**, enable the cards you need. Drag them to reorder, or use **Alt + Up/Down**.
4. Use the **+** tile to add favorites; right-click a shortcut to edit it.
5. For music in Chrome tabs, click **Enable browser media** and allow site access.

Settings save automatically. **Focus** temporarily hides widgets and favorites.

<a id="features"></a>

## ✨ Features

| Feature | What it does |
| --- | --- |
| **Appearance** | Dark, light, or system theme; built-in and uploaded wallpapers; colors, fonts, opacity, and interface size. |
| **Widgets** | Clock, notes, tasks, weather, news, music, and system information, with adjustable order and visibility. |
| **Search & shortcuts** | Multiple search providers, keyboard-selected suggestions, and grouped favorites. |
| **Browser media** | Metadata and playback controls for accessible audio/video in Chrome tabs. Track controls depend on the player. |
| **Desktop integration** | Optional Windows desktop music controls and CPU, RAM, and fixed-disk information. |
| **Backups** | Export and import settings, favorites, widget content, profile, wallpaper, and widget order. |

Calendar is disabled in the current release. Its source and existing backup data are preserved for compatibility.

<a id="windows-companion"></a>

## 🪟 Optional Windows companion

Browser music works without the companion. Install it for desktop apps, such as Spotify, and system information.

Run the separately supplied `PikaDesk-Companion-0.2.1-Setup-x64.exe`, keep **Connect automatically** selected, then refresh the dashboard.

The helper targets **Windows 10 version 2004 or later / Windows 11, x64**. Its runtime is included, no administrator access is needed, and Chrome starts it on demand. The installer is currently unsigned. GPU readings are unavailable.

See [setup and troubleshooting](docs/COMPANION.md) or the [native-host guide](companion/README.md).

<a id="data-and-backups"></a>

## 💾 Data and backups

Notes, tasks, profile images, wallpaper, and widget order stay on the device. Small preference collections may use Chrome sync, controlled by your browser account.

Use **Settings → Data & Backup** to export before reinstalling or changing profiles. New backups use `pikadesk-settings.json`; older `pikanav-settings.json` files still import.

Search suggestions, weather, news, favicons, voice search, and media artwork can contact external services. PikaDesk has no product account, advertising, analytics, or telemetry endpoint. See [privacy and permissions](docs/PRIVACY.md) for the data flows.

<a id="updating"></a>

## 🔄 Updating

Export a backup, replace the existing extension folder's contents with the new package's `extension` contents, then click **Reload** at `chrome://extensions/`. Open a new tab afterward.

Existing stable-key installations keep ID `abipfjhfejgjkhcpilkfdhbgaepljpki`. The manifest key, storage keys, backup format, and companion protocol remain compatible. Older 0.2.0 / 1.0.0 copies may have different IDs: export from the old copy and import into the new one.

<a id="troubleshooting"></a>

## 🛠️ Troubleshooting

<details>
<summary>Frequently asked questions</summary>

**Chrome cannot find the manifest.**

Select the extracted **extension** folder containing `manifest.json` and `index.html`. A source ZIP needs to be built first.

**Browser music is not detected.**

Start playback in the same Chrome profile, then enable browser media and allow site access. Restricted pages and inaccessible players cannot be inspected. Previous/next stay disabled when the player does not expose supported controls.

**Why does desktop music need a helper?**

The companion connects Chrome to Windows desktop media sessions and system metrics through native messaging. It is optional for the dashboard and browser media.

**The companion does not connect.**

Rerun its installer, use **Connect automatically**, and refresh PikaDesk. Custom profiles can use manual pairing. See the [companion troubleshooting guide](companion/README.md#troubleshooting).

</details>

For bugs or suggestions, [open an issue](https://github.com/MelonPika/PikaSpace/issues) with your browser version, reproduction steps, and a screenshot.

<a id="development"></a>

## 🧑‍💻 Development

Requires **Node.js 22.12+ and npm**.

```sh
npm ci
npm run build
```

Load `dist/` in Chrome to test extension integrations. Use `npm run dev` for the web preview, `npm run package` for local ZIPs, and `npm test` for regression, type, build, and manifest checks.

The [developer guide](docs/DEVELOPMENT.md) covers all commands, browser tests, packaging, project structure, cleanup, and companion development. See also [release notes](docs/RELEASE-NOTES.md), [store preparation](docs/STORE-PREPARATION.md), and [historical archives](docs/archive/README.md).

<a id="credits"></a>

## Credits

Built with React, TypeScript, Vite, and Lucide. See [attributions](ATTRIBUTIONS.md), [dependency notices](public/THIRD_PARTY_LICENSES.txt), and the [original dashboard design](https://www.figma.com/design/yCDgbKZjXOC3yYOOVFB6Uu/Customizable-New-Tab-Dashboard).

<p align="center">
  <a href="https://github.com/MelonPika/PikaSpace">Repository</a> ·
  <a href="https://github.com/MelonPika/PikaSpace/releases">Releases</a> ·
  <a href="docs/PRIVACY.md">Privacy</a> ·
  <a href="#top">↑ Back to top</a>
</p>
