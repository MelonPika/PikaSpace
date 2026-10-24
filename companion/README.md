# PikaNav Windows Companion

The Windows companion reads and controls the current Windows desktop media session and reports system metrics. `native-host/` contains the helper, `installer/` contains the EXE setup wizard, `scripts/` contains build/install tools, and `diagnostics-extension/` contains the older developer diagnostic popup.

It can:
- Check whether the Windows companion is connected.
- Read the current title, artist, album, source app, and playback status.
- Send Play/Pause, Previous, and Next commands to the active Windows media session.
- Read basic Windows system stats: CPU usage, physical memory usage, fixed disk usage, and best-effort GPU placeholders.

The runtime helper has no tray app, service, updater, web server, or localhost HTTP server. A separate EXE setup wizard installs it and adds a Windows Apps uninstall entry. Chrome starts the hidden helper only when needed; it exits when disconnected.

## Requirements

- Windows 10 version 2004 or later / Windows 11, x64
- Google Chrome
- No additional runtime or developer tools for the EXE installer

Building from source requires a .NET SDK supporting .NET 8. The legacy PowerShell development install also needs the shared .NET 8 runtime on the target machine.

## Load the Chrome extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select `companion/diagnostics-extension` (the diagnostic popup) or a dashboard release under `releases/`.
5. Copy the extension ID shown by Chrome.

## Install the Windows companion

For users, run `releases/companion/PikaNav-Companion-0.2.1-Setup-x64.exe` from the repository root and choose **Connect automatically**, then refresh PikaNav. Setup detects existing PikaNav dashboards in standard Chrome profiles and includes the stable portable-release ID. No administrator permissions or PowerShell commands are needed. Manual ID entry remains available for the diagnostic extension in this folder and custom profiles. Rerun Setup to update or reconnect; uninstall from Windows Settings > Apps.

Run `npm run package:companion` from the repository root to build the EXE. See [packaging and verification](../docs/COMPANION.md) for compiler bootstrapping, preconfigured IDs, and isolated installer tests.

The older development-only installation remains available from the `companion` folder:

```powershell
.\scripts\install-companion.ps1 -ExtensionId "YOUR_EXTENSION_ID"
```

Both installers copy the native host to `%LOCALAPPDATA%\PikaNav\MediaHost`, create `com.pikanav.media.json`, and register it under:

```text
HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.pikanav.media
```

Admin permissions are not required.

## Manual test steps

1. Load the extension manually in Chrome using Load unpacked.
2. Copy the extension ID from `chrome://extensions`.
3. Run:

```powershell
.\scripts\install-companion.ps1 -ExtensionId "YOUR_EXTENSION_ID"
```

4. Restart Chrome, or reload the extension from `chrome://extensions`.
5. Start music in Spotify, YouTube Music, Chrome, Edge, or another Windows media app.
6. Open the PikaNav Media extension popup.
7. Confirm the status says the companion is connected.
8. Click Refresh.
9. Verify Title, Artist, Album, Source/App, and Status update.
10. Click Refresh System Stats.
11. Verify CPU, Memory, Disk, and GPU fields update.
12. Click Play/Pause and confirm playback toggles in the media app.
13. Click Next and confirm the next track is requested.
14. Click Previous and confirm the previous track is requested.
15. Stop all media apps, click Refresh, and confirm the popup shows no active media session.
16. Uninstall the companion:

```powershell
.\scripts\uninstall-companion.ps1
```

17. Reload the extension and open the popup.
18. Confirm it shows: `PikaNav Windows Companion is not installed or not registered.`

## Native commands

The extension talks to the existing native messaging host, `com.pikanav.media`. The host accepts these command payloads:

```json
{ "type": "ping" }
```

```json
{ "type": "getCurrentMedia" }
```

```json
{ "type": "playPause" }
```

```json
{ "type": "next" }
```

```json
{ "type": "previous" }
```

```json
{ "type": "getSystemStats" }
```

`getSystemStats` returns:

```json
{
  "ok": true,
  "cpu": {
    "usagePercent": 12.5
  },
  "memory": {
    "usedMb": 10240,
    "totalMb": 32768,
    "usagePercent": 31.2
  },
  "disk": [
    {
      "name": "C:\\",
      "usedGb": 180.5,
      "totalGb": 512.0,
      "usagePercent": 35.2
    }
  ],
  "gpu": {
    "usagePercent": null,
    "memoryUsedMb": null,
    "memoryTotalMb": null,
    "note": "GPU stats may not be available on all systems"
  }
}
```

If a command fails, the host returns:

```json
{ "ok": false, "error": "..." }
```

## Troubleshooting

### Native host not found

If the popup says the companion is not installed or registered:

- Confirm the install script completed successfully.
- Confirm this registry key exists:

```text
HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.pikanav.media
```

- Confirm the default registry value points to the absolute path of `com.pikanav.media.json`.
- Confirm the JSON manifest `path` points to `PikaNav.MediaHost.exe`.

### Wrong extension ID

The native messaging manifest must contain the exact loaded extension ID:

```json
"allowed_origins": [
  "chrome-extension://YOUR_EXTENSION_ID/"
]
```

If the ID is wrong, rerun the EXE Setup wizard. For the legacy development install, rerun:

```powershell
.\scripts\install-companion.ps1 -ExtensionId "YOUR_EXTENSION_ID"
```

### Do not write logs to stdout

Chrome Native Messaging uses stdout for protocol messages only. The native host writes error logs under:

```text
%LOCALAPPDATA%\PikaNav\MediaHost\logs
```

### Some apps may not expose media sessions

This MVP uses Windows `GlobalSystemMediaTransportControlsSessionManager`. Some apps do not expose a session, metadata, or transport controls through Windows GSMTC.

### System stats limitations

CPU and memory stats use lightweight Windows kernel APIs and should work without admin permissions. Disk usage comes from .NET `DriveInfo` and only reports ready fixed drives.

GPU stats are best-effort. The current companion returns nullable GPU usage and memory fields with a note because Windows does not expose a single lightweight, reliable, non-admin .NET API for all GPU vendors and driver versions.

## Uninstall

For an EXE installation, use **Windows Settings > Apps > PikaNav Windows Companion > Uninstall**. The legacy helper script delegates to the EXE uninstaller when present:

```powershell
.\scripts\uninstall-companion.ps1
```

This removes the companion files and its Chrome registration. The EXE uninstaller preserves diagnostic logs and any registration since taken over by another installation. The legacy script removes its entire install folder.

## Assumptions

- Setup automatically discovers dashboard IDs from Chrome's local extension records and includes the stable portable ID. The user can override pairing manually for diagnostic builds or unusual profiles.
- Google Chrome is the target browser for this MVP.
- The EXE includes the runtime. Only source builds and the legacy developer install need developer tools.
- The native host targets `win-x64`.
- The active media app supports Windows GSMTC metadata and controls.
- The MVP does not need persistent background polling; the popup requests state when opened or refreshed.
