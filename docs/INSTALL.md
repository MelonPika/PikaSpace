# Install PikaSpace 1.0.0

Download current packages from the [PikaSpace releases page](https://github.com/MelonPika/PikaSpace/releases).

1. Extract the PikaSpace ZIP to a permanent folder on your computer.
2. Open `chrome://extensions` in desktop Google Chrome.
3. Enable **Developer mode**, then choose **Load unpacked**.
4. Select the extracted **extension** folder (the one containing `manifest.json`).
5. Open a new tab and accept Chrome's new-tab change if prompted.

No Node.js, .NET, development server, or companion installation is needed for the dashboard and browser media mode. This package contains no personal settings or account credentials.

Keep the extracted folder: Chrome reads the extension from that location. For future updates, export a backup, replace the extension files, and click **Reload** at `chrome://extensions`. The manifest key keeps the release on stable ID `abipfjhfejgjkhcpilkfdhbgaepljpki`. Use **Settings → Data & Backup** to export or import `pikaspace-settings.json` when moving to another Chrome profile.

Settings save locally first. Small preference collections also use Chrome sync when available; Chrome controls whether account sync is enabled. Large collections stay local with an explanatory message. Profile, wallpaper, widget content/order remain local, so use backups to move them.

## Use the dashboard

- Choose a search engine and mode, then type a search or website address. Arrow keys select suggestions; Enter opens the selected result. Perplexity has no autocomplete. Image selection searches by filename; the image is not uploaded for reverse-image recognition.
- Use the **+** tile to add favorites and right-click a favorite to edit/delete it. Manage groups under **Settings → Layout**.
- Enable widgets under **Settings → Widgets**. Drag cards to reorder them, or focus a card and use **Alt + Up/Down**. Focus hides widgets/favorites; select it again to restore them.
- Notes/tasks save on this device. The complete task list scrolls and supports up to 100 tasks; delete a task before adding another at the limit.
- Weather can use a selected city or browser location. Weather/news have Retry buttons for recoverable failures. Clock, notes, tasks, preferences, and existing shortcuts remain usable offline; external sites and online services require a connection.
- Escape closes dialogs. Tab/Shift+Tab stay inside settings, profile, and favorite dialogs.

**Reset preferences and favorites** resets the named settings, favorites/groups, selected weather location, and wallpaper after confirmation. It retains notes, tasks, dormant events, profile, and widget order. Read `PRIVACY.md` for external-service data flows.

## Music without the companion

1. In the Music widget, click **Enable browser media** and allow Chrome's site-access request. Access lets PikaSpace read player metadata and control audio/video in your open web tabs. You can remove this access in the extension's details at any time.
2. Start playback in a Chrome tab, then return to PikaSpace.
3. The widget displays **Chrome tab** with the site's name. Play/pause works for accessible HTML audio/video players. Previous/next are enabled only when a supported site's track buttons are available (YouTube, YouTube Music, Spotify web, and SoundCloud).

The widget prefers a playing browser session, then a paused session. Browser media works only in this Chrome profile. Restricted Chrome pages, other browsers, desktop applications, inaccessible embedded players, shadow-DOM-only players, and players that do not expose an HTML audio/video element are not supported by browser mode. Sites can change their controls; unavailable track buttons stay disabled. Start playback in the site's own tab first if autoplay is blocked.

## Optional Windows companion

Windows desktop media (for example, the Spotify desktop app) and CPU/RAM/disk widgets still need the native companion. If no browser player is found, PikaSpace tries the registered companion automatically. The portable ZIP deliberately contains only the Chrome extension.

1. Load PikaSpace in Chrome, then run **PikaSpace-Companion-1.0.0-Setup-x64.exe** from the separate companion download (`releases/companion` in the source project).
2. Keep **Connect automatically** selected and choose **Install**, then refresh PikaSpace. There is normally no extension ID to copy.
3. If the extension was just loaded, close and reopen Chrome so it saves its extension record, then click **Detect again**. For a custom Chrome profile location, use **Enter extension IDs manually** as the fallback.

Setup detects PikaSpace across the standard Chrome Stable/Beta/Dev/Canary/Testing profile folders. It reads local extension records and checks the manifest and background script, without modifying browser preferences. It also registers the stable ID used by PikaSpace. Future releases with that same key keep the ID even when the folder moves. The setup wizard retains manual pairing for diagnostic builds and unusual profile locations.

The installer supports Windows 10 version 2004 or later / Windows 11 on x64. It includes its runtime: users need no .NET installation, PowerShell commands, or administrator permissions. It installs under `%LOCALAPPDATA%\PikaNav\MediaHost` and registers the Chrome connection for the current Windows user. Chrome starts the hidden helper on demand and it exits on disconnect; no tray app, startup task, Windows service, or local web server is installed.

Run a newer installer to update, or rerun it to pair a changed unpacked extension ID. Uninstall through **Windows Settings > Apps > PikaSpace Windows Companion**. Existing diagnostic logs may remain. Browser music continues to work after the companion is removed. GPU values are currently unavailable, including with the companion. See [companion details](COMPANION.md) for build instructions and verification. The companion is optional for normal dashboard use.

## Future feature: Calendar

Calendar is postponed beyond Version 1.0. It has no widget, navigation, notifications, OAuth permissions, API calls, or refresh timers in this release. The clock/date widget remains available.

## Distribution

This ZIP installs through **Load unpacked** with Developer mode. Public one-click installation requires an approved Chrome Web Store listing. No submission has been made. The source release also provides a separate store-layout ZIP for publisher review.

The dashboard contains no machine-specific paths. Windows desktop Chrome is the primary verified target. macOS/Linux and other Chromium browsers need their own verification; the companion is Windows-only. Real site-access prompts, third-party media controls, speech recognition, and remote services can vary by browser and policy. See the development and companion guides for verification commands and platform limits.

## Remove PikaSpace

Use **Remove** at `chrome://extensions`, then delete the extracted folder if it is no longer needed. Export settings first if you want to keep them.
