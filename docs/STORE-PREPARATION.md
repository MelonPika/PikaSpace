# Chrome Web Store preparation — PikaSpace 1.0

This records preparation, not submission or Google approval. Nothing has been published.

## Prepared

Manifest V3, version 1.0.0, bundled scripts/styles, local module worker, static new-tab override, explicit CSP, 16/48/128 PNG branding icons, privacy/install/release documents, and third-party notices are prepared. `PikaSpace-1.0.0-chrome-web-store.zip` has the manifest at its root and contains runtime files only. No native binaries, test data, source maps, OAuth client, or personal settings are included.

The portable manifest's public key fixes its unpacked ID. Before store publication, obtain the assigned store public key/ID from the developer dashboard and configure the store build and companion for that identity. The local portable key is not a reserved Chrome Web Store identity. Existing local settings require export/import if the ID changes.

Suggested single purpose: **A personal new-tab dashboard for web search, daily shortcuts, notes, tasks, and useful widgets.**

Name: **PikaSpace**. Description: **A customizable Chrome new-tab dashboard with widgets, shortcuts, music controls, and a personalized workspace.**

Tagline: **Your Browser, Your Workspace.** Source/support: [PikaSpace](https://github.com/MelonPika/PikaSpace) · [Issues](https://github.com/MelonPika/PikaSpace/issues).

Do not advertise Calendar as available, automatic image uploads or integrated reverse-image recognition, or the Windows companion as bundled. Image search previews local files and opens the provider's official page; users select/upload the image there. Voice search depends on browser speech support and requires explicit consent before microphone access.

## Permission justifications

| Permission/access | Purpose |
| --- | --- |
| `storage` | Retain preferences/content and optionally sync small preference collections. |
| `scripting` | Inspect/control permitted HTML media on demand; no persistent content script. |
| `nativeMessaging` | Optional local Windows desktop media/system metrics; absent hosts fail gracefully. |
| `geolocation` | Resolve location for enabled weather; chosen cities/fallbacks also work. |
| Open-Meteo hosts | Weather and city search. |
| Google/Bing/DuckDuckGo suggestion hosts | Suggestions from the selected supported engine. |
| Google News host | Selected-topic RSS. |
| Optional HTTP/HTTPS hosts | User-approved browser-player inspection/control across web tabs; revocable and enforced per frame/document. |

`identity`, `tabs`, Calendar scopes, and Google API hosts are removed. No history, downloads, notifications, debugger, or unlimited-storage permission is requested; shortcut links open browser pages.

## Publisher work before submission

- Host the reviewed privacy policy at a public, stable URL and supply a real support contact. Local Markdown does not fill the public URL requirement.
- Complete the developer account, listing/category, distribution details, support information, screenshots/promotional assets, and Privacy practices form. Check every data flow in `PRIVACY.md`; local processing alone does not justify answering every collection/use question "No".
- Accurately disclose website-content/media access, search and location handling, and optional Windows requirements. Justify all permissions, including optional broad site access. Review Limited Use obligations before certification.
- Supply reviewer steps for browser media and the companion-absent state. Complete remaining manual/platform/live-provider checks in the development and companion guides.
- Obtain the owner's explicit approval before uploading, submitting, or publishing.

Reviewed on 24 October 2026 against Google's [Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies), [privacy fields guidance](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), and [storage API](https://developer.chrome.com/docs/extensions/reference/api/storage). Recheck when submitting. Local checks do not guarantee store acceptance.
