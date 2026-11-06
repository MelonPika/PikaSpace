# Chrome Web Store preparation — PikaSpace 1.0

This records preparation, not submission or Google approval. Nothing has been published.

## Prepared

Manifest V3, version 1.0.0, bundled scripts/styles, local module worker, static new-tab override, explicit CSP, 16/48/128 PNG branding icons, privacy/install/release documents, and third-party notices are prepared. `PikaSpace-1.0.0-chrome-web-store.zip` has the manifest at its root and contains runtime files only. No native binaries, test data, source maps, OAuth client, or personal settings are included.

The packaging script removes the manifest's `key` field from the store ZIP to avoid the upload error `key field is not allowed in manifest`. The source, `dist/`, and portable ZIP retain the public key that fixes the unpacked ID. Upload `PikaSpace-1.0.0-chrome-web-store.zip` rather than the portable ZIP or a manually zipped `dist/`.

After the first store upload, obtain the assigned store public key/ID from the developer dashboard. Use that public key in a separate local development copy to test with the store identity, and configure the companion for the assigned store ID. See Chrome's [extension key guidance](https://developer.chrome.com/docs/extensions/reference/manifest/key). The local portable key is not a reserved Chrome Web Store identity. Existing local settings require export/import if the ID changes.

Use the single purpose description and permission explanations below when completing the item's **Privacy practices** tab.

Name: **PikaSpace**. Description: **A customizable Chrome new-tab dashboard with widgets, shortcuts, music controls, and a personalized workspace.**

Tagline: **Your Browser, Your Workspace.** Source/support: [PikaSpace](https://github.com/MelonPika/PikaSpace) · [Issues](https://github.com/MelonPika/PikaSpace/issues).

Do not advertise Calendar as available, automatic image uploads or integrated reverse-image recognition, or the Windows companion as bundled. Image search previews local files and opens the provider's official page; users select/upload the image there. Voice search depends on browser speech support and requires explicit consent before microphone access.

## Privacy practices: copy-ready answers

The missing-justification messages refer to fields in the Chrome Web Store Developer Dashboard. Editing the manifest or uploading a ZIP does not fill these fields. Open the uploaded item's **Privacy practices** tab, paste each answer into the matching field, complete the remote-code and data-use declarations, and save the draft. These answers describe the current 1.0.0 implementation; review them again if the uploaded build changes.

### Single purpose description

PikaSpace replaces Chrome's new-tab page with a customizable personal dashboard that brings web search, favorite shortcuts, notes, tasks, weather, news, and media controls into one workspace. Users can personalize its appearance and widget layout. Optional Windows companion integration displays desktop media and system information in the same dashboard.

### scripting justification

PikaSpace uses chrome.scripting.executeScript to run its packaged media-inspection function in permitted tabs and frames. The music widget reads HTML audio/video playback state, Media Session metadata, artwork URLs, and supported player controls. User actions send play/pause or supported previous/next commands to the displayed media document. It does not install a persistent content script or use this access for advertising or analytics.

### nativeMessaging justification

PikaSpace uses chrome.runtime.connectNative to communicate with the separately installed, optional PikaSpace Windows Companion (com.pikanav.media). This local connection provides desktop media metadata and playback controls, plus CPU, RAM, and fixed-disk metrics for dashboard widgets. It does not send this information to a PikaSpace server. The dashboard and browser media continue to work without the companion.

### storage justification

PikaSpace uses chrome.storage.local to retain dashboard preferences, favorites and groups, the selected weather location, notes, tasks, and uploaded wallpaper between new-tab sessions. Small preference, favorites, and weather-location collections also use chrome.storage.sync within Chrome's quota. Notes, tasks, and wallpaper files remain local; profile/avatar and widget order use local browser storage. chrome.storage.session keeps temporary companion connection status.

### geolocation justification

PikaSpace uses the browser's location API to obtain coordinates for the new-tab weather widget when weather is enabled and no saved location is available. Coordinates and timezone are sent to Open-Meteo to retrieve local conditions and forecasts. Users can choose a city manually; unavailable location access uses a labelled fallback city. Disabling weather stops its refreshes.

### Host permission justification

Required HTTPS hosts support dashboard widgets: api.open-meteo.com retrieves weather for the selected coordinates; geocoding-api.open-meteo.com resolves city searches; suggestqueries.google.com, api.bing.com, and duckduckgo.com return suggestions for text typed into the selected search engine; news.google.com retrieves topic-based news RSS. Optional http://*/* and https://*/* access is requested through Enable browser media so the music widget can detect and control HTML audio/video in permitted tabs and frames. Broad optional access supports players on user-chosen sites, including embedded players, rather than a fixed domain list. Media metadata is displayed locally; artwork may load from its original server. Users can revoke site access in Chrome's extension settings.

### Remote code

Select **No, I am not using remote code.** The current extension bundles its JavaScript and uses a local module service worker. API responses, RSS, favicons, and media artwork are data or display resources; their presence does not mean the extension executes remote code. The optional native companion is a separately installed local application.

Leave the remote-code justification blank when selecting No disables it or makes it optional. If the dashboard still requires an explanation, use:

> All extension JavaScript is included in the uploaded package. PikaSpace does not download or execute remote JavaScript or WebAssembly. External requests retrieve weather, city results, search suggestions, news, and images, which are processed as data or displayed as images.

Do not select Yes merely to enable a justification box. Manifest V3 does not permit loading and executing remotely hosted extension code; an explanation would not make that implementation acceptable.

## Data usage and certification

The following are recommended selections for the current 1.0.0 implementation, based on the form's supplied definitions and the data flows in [PRIVACY.md](PRIVACY.md). They are a mapping of the implementation to the form, not a determination by Google. Google's [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) requires disclosures even when data is processed or stored only on the user's device.

| Form checkbox | Selection | Reason |
| --- | --- | --- |
| Personally identifiable information | Check | The optional profile stores a user-entered display name and avatar locally. A name does not stop being personal information because it stays on the device. |
| Health information | Leave unchecked | No feature specifically requests or reads health records or measurements. |
| Financial and payment information | Leave unchecked | No payment, transaction, credit, or financial-record feature. |
| Authentication information | Leave unchecked | No product login, password collection, or authentication-token access. Existing provider cookies are handled by the browser; PikaSpace does not read them. |
| Personal communications | Leave unchecked | No email, chat, or messaging access. Voice-search commands are speech input for search, not access to private calls or messages. |
| Location | Check | Browser coordinates and timezone are sent to Open-Meteo; selected location may use Chrome sync. External service requests also expose the IP address to the recipient. |
| Web history | Check | The media feature reads permitted media-page titles and hostnames, and favorites contain website URLs. This recommendation covers website-associated information despite the absence of the chrome.history permission or a browsing-history log. |
| User activity | Leave unchecked | No network-activity monitoring, clickstream, mouse/scroll tracking, or keystroke logging. Handling input and buttons to provide search/media controls does not itself create a separate activity log. |
| Website content | Check | Media metadata, artwork URLs, and player state are read for the music widget. Notes, tasks, local image previews, and optional speech input also handle text, images, or sounds for dashboard features. |

Additional transmission details to keep consistent with the listing and policy:

- Search and website information: typed queries sent to the selected suggestion/search provider, favorite site origins sent to Google for icons, and favorites synchronized through Chrome.
- Media artwork: fetching it contacts its source server; media metadata is otherwise displayed locally.
- Optional voice input: after explicit consent, the browser speech service may process audio remotely. PikaSpace does not store audio.
- Dashboard content and personalization: notes, tasks, profile/avatar, and uploaded wallpaper stored locally; limited preference collections can use Chrome sync.

The absence of a PikaSpace backend does not mean no user data is handled or transmitted. Match the form's categories to these flows and keep the listing and public privacy policy consistent. The publisher must review the actual data practices before certifying them.

In the data-use certification section, all three statements must be selected before submission. Review each statement and confirm it accurately describes the uploaded build and the publisher's practices:

1. User data is not sold or transferred for purposes outside the permitted uses.
2. User data is used and transferred only for the extension's disclosed single purpose.
3. User data is not used or transferred for creditworthiness or lending decisions.

These statements are a publisher attestation, not another justification text field. Check all required certifications only when they accurately describe the extension and the publisher's practices, then save the Privacy practices draft. A public, stable privacy-policy URL must also be entered; a local Markdown file does not fill that field. Saving the draft does not submit or publish the extension.

## Privacy policy URL

The policy file was verified in the public PikaSpace repository on 6 November 2026. Enter the direct policy-page URL:

```text
https://github.com/MelonPika/PikaSpace/blob/main/docs/PRIVACY.md
```

Keep the repository public and publish the latest reviewed version of [PRIVACY.md](PRIVACY.md) at this path before submission. Local edits do not update the public policy automatically.

## Other permission notes

`identity`, `tabs`, Calendar scopes, and Google API hosts are removed. No history, downloads, notifications, debugger, or unlimited-storage permission is requested; shortcut links open browser pages.

## Publisher work before submission

- Publish the latest reviewed privacy policy at the public URL above and confirm the linked support channel is available. Local edits do not update the public page automatically.
- Complete the developer account, listing/category, distribution details, support information, screenshots/promotional assets, and Privacy practices form. Check every data flow in `PRIVACY.md`; local processing alone does not justify answering every collection/use question "No".
- Accurately disclose website-content/media access, search and location handling, and optional Windows requirements. Justify all permissions, including optional broad site access. Review Limited Use obligations before certification.
- Supply reviewer steps for browser media and the companion-absent state. Complete remaining manual/platform/live-provider checks in the development and companion guides.
- Obtain the owner's explicit approval before uploading, submitting, or publishing.

Privacy practices answers reviewed on 6 November 2026 against the current source and Google's [Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies), [privacy fields guidance](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), and [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq). Recheck when submitting. Local checks do not guarantee store acceptance.
