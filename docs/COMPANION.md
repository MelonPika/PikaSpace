# PikaSpace Windows Companion 1.0.0

The optional Windows companion provides desktop media metadata/controls and CPU, physical RAM, and fixed-disk usage. GPU readings remain unavailable. Browser music does not require this companion.

## Install, update, and remove

Distribute `releases/companion/PikaSpace-Companion-1.0.0-Setup-x64.exe` with `INSTALL.txt` and `SHA256SUMS.txt`. Users run the EXE, keep **Connect automatically** selected, install, and refresh the dashboard. There is normally no ID to copy. The runtime is included; no SDK, shared .NET runtime, command line, or administrator permission is required. The target is Windows 10 version 2004 or later / Windows 11 on x64.

Installation belongs to the current Windows user, under `%LOCALAPPDATA%\PikaNav\MediaHost`. Setup registers `com.pikanav.media` under that user's Chrome NativeMessagingHosts key. The manifest authorizes only exact paired extension IDs, with no wildcard origins. Automatic mode reads extension records from `Preferences` and `Secure Preferences` in standard Chrome Stable/Beta/Dev/Canary/Testing profile folders. It checks existing extension files for the PikaSpace name, MV3/new-tab/native-messaging configuration, and the expected host commands in the background script. Disabled, missing, malformed, unrelated, or name-only matches are skipped. This is best-effort local discovery rather than a publisher-signature verification. It does not edit Chrome files or inspect history/cookie databases.

The setup-only detector is a small hidden executable using the .NET Framework included with supported Windows versions. It is extracted to Setup's temporary folder and is not installed as another background process. If the extension was just loaded, close/reopen Chrome to save the preference record and click **Detect again**. For custom data locations, administrators can pass `/CHROMEDATADIR="C:\Custom\Chrome User Data"`, or users can choose manual pairing. Up to 10 comma-separated IDs are supported. More than 10 discovered IDs causes fallback rather than silently dropping entries.

Setup also includes the stable portable-release ID `abipfjhfejgjkhcpilkfdhbgaepljpki`, derived from the persistent public `key` in `public/manifest.json`. The build derives this ID automatically with `scripts/extension-identity.mjs`. Automatic setup retains saved pairing when discovery is unavailable, then uses distributor defaults or the stable portable ID. Manually supplied IDs override automatic selection. The normal Chrome registration is shared across that Windows user's Chrome profiles.

Run a newer EXE to update or repair. Pairing is remembered and remains editable. If files are in use, close Chrome before updating. Remove the helper in Windows Settings > Apps > PikaSpace Windows Companion. Uninstall removes installer-owned files, bundled runtime, Chrome manifest, and the registration if it still points to this installation. Diagnostic logs may remain. Dashboard settings are stored by the extension and are unaffected.

## Resource use

There is no always-running application, tray icon, Windows service, scheduled task, startup entry, updater, or local HTTP server. The hidden Windows executable communicates only over Chrome's native-messaging pipes. The current extension opens a connection per request; the process exits when that connection closes. The dashboard polls only while its relevant widgets and page are visible.

CPU and RAM use Windows kernel APIs; fixed-disk capacity uses `DriveInfo`. CPU sampling waits asynchronously for 250 ms. Media uses Windows' media session API. No additional telemetry or network component is included. The installer compresses the self-contained runtime into one download; the installed runtime files remain separate to avoid extracting a single-file bundle on every request. Runtime/WinRT reflection metadata is preserved rather than applying unverified trimming.

## Build

From the repository root, on Windows with Node.js 22.12+ and a .NET SDK supporting the project's .NET 8 target:

```powershell
npm run package:companion
```

This publishes the release host with a self-contained x64 runtime, compiles the setup-only detector with Windows' built-in Framework compiler, derives the stable extension ID, compiles the setup wizard, copies runtime redistribution notices, and writes the EXE, install guide, and SHA-256 file under `releases/companion`. It does not install the companion or change Chrome's normal registration.

The build uses Inno Setup 6.3+ or 7. If no supported compiler is found, `-BootstrapCompiler` downloads the pinned official Inno Setup 6.7.3 installer, verifies its SHA-256 and publisher signature, and extracts it in portable mode under `.cache/installer-tools/inno`. No compiler installation, file associations, or system shortcuts are created. The npm command includes this switch. To use an existing compiler directly:

```powershell
.\companion\scripts\build-companion.ps1 -InnoSetupCompilerPath 'C:\Tools\Inno Setup 6\ISCC.exe'
```

To include additional known IDs, such as an assigned Chrome Web Store ID, use a distributor-specific build:

```powershell
.\companion\scripts\build-companion.ps1 -BootstrapCompiler -ExtensionId 'YOUR_32_LETTER_CHROME_EXTENSION_ID'
```

Do not use the development `install-companion.ps1` to overwrite an EXE-managed install; it deliberately refuses. Its framework-dependent developer workflow remains separate from end-user distribution.

The generated development EXE is unsigned. Public distribution requires publisher-owned code signing for the helper and the setup EXE. The build does not disable SmartScreen or install a trusted certificate. Self-contained runtime servicing requires rebuilding and redistributing the companion when the bundled runtime is updated.

## Verification

```powershell
npm run test:companion
```

This builds the same setup script with a separate test application identity and a test-only native-host registry key. Detection fixtures verify multiple profiles, relative installed paths, absolute unpacked paths, duplicate IDs, malformed data, disabled/unrelated/name-only matches, and unchanged preference-file hashes. Setup tests install into `.verification/companion`, including a Unicode/apostrophe path, and verify discovery and stable-ID setup with no ID argument, manual override, UTF-8 JSON without a BOM, self-contained runtime files, hidden console subsystem, remembered pairing, repair, ownership-aware cleanup, and uninstall. Invalid/missing IDs are also rejected with automatic defaults explicitly disabled in the test build. The installed executable receives real framed native-messaging ping, CPU/RAM/disk, media-read, invalid JSON, and unknown-command requests, followed by disconnect/exit verification. Desktop playback controls are not invoked. Results and installer logs are saved under `.verification/companion`.

After `npm run build`, run `node tests/detection-browser.mjs` for a disposable real Chrome profile containing the current PikaSpace release. It verifies actual Chrome-generated preference records. `npm run test:browser` also verifies Chrome's runtime ID matches the manifest key while exercising the dashboard and independent browser-media copy.

The tests leave the normal Chrome NativeMessagingHosts key untouched. An interactive wizard check and a clean Windows machine without .NET are separate release checks; protocol checks and runtime-content inspection cannot replace those platform checks.
