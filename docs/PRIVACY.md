# PikaSpace 1.0 privacy and external services

Project and support: [PikaSpace](https://github.com/MelonPika/PikaSpace) · [Issues](https://github.com/MelonPika/PikaSpace/issues).

PikaSpace is a personal new-tab dashboard. It has no PikaSpace account, advertising, analytics, telemetry endpoint, or Calendar sign-in. Shipped code runs locally; no remote JavaScript is downloaded or executed.

## Storage

Profile/avatar, wallpaper, widget order, notes, tasks, and reserved event data stay on the device. Preferences, favorites/groups, and selected weather location save locally and, within Chrome's quota, also use Chrome sync. Chrome controls account synchronization. When Chrome storage fails, PikaSpace attempts a local browser-storage recovery copy and displays a message. Total save failures are reported; export a backup before closing the tab.

Exported JSON includes settings and content; importing stays on the device. Resetting preferences/favorites retains notes, tasks, dormant events, profile, and order. Removing the extension can remove local data; export first. Browser/account sync data is subject to the browser provider's controls.

## Requests to other services

| Feature | Data and recipient |
| --- | --- |
| Suggestions | Queries of at least two characters are sent while typing to the selected Google, Bing, or DuckDuckGo suggestion service. Recognized website addresses do not request suggestions. Perplexity has no autocomplete; input is not silently forwarded to another engine. |
| Search/navigation | Submitting opens the selected provider's search URL or entered website. Search text forms part of that URL. |
| Image search | The chosen image stays local. Its filename supplies a text search; PikaSpace does not upload it for reverse-image recognition. |
| Voice search | If available and authorized, the browser's speech service may send audio to its provider. PikaSpace uses resulting text for search. |
| Favicons | Google receives favorite website origins to retrieve icons. Engine icons load from their providers. Favorite page paths, notes, and tasks are not sent for icons. |
| Weather | Enabled weather sends coordinates/timezone to Open-Meteo. City search sends city text to its geocoding service. Browser location uses the browser's location service; denied/unavailable access falls back to a labelled approximate city. Disabled weather does not poll. |
| News | Enabled news sends the selected topic to Google News RSS. Opening an article visits the linked site. |
| Browser media | Optional site access reads HTML media state, Media Session metadata/artwork addresses, and supported player controls in permitted tabs. Metadata displays locally. Artwork loads from its source, which can reveal the user's IP address to its server. |
| Windows companion | Optional local native messaging exchanges desktop media metadata/controls and system metrics with the installed Windows host. During setup, automatic detection uses extension records in Chrome's local preference files and checks PikaSpace's local manifest/script. It does not modify or upload browser profile data. No PikaSpace server is involved. |

Providers receive ordinary network information such as IP address and handle services under their own privacy terms. External destinations can use existing browser cookies. Remove browser-media access in the extension's details; disable weather/news in Settings to stop their refreshes. Use text search when voice recognition is unavailable.

PikaSpace does not sell data or send notes, tasks, profile photos, or wallpaper files to advertising/analytics services. Optional site access is used to display/control the requested player. No Calendar tokens or requests are used in 1.0; dormant event data is retained.

For support, use the distributor's published contact. The publisher must supply a real support contact and public policy URL before store publication. This local policy is supplied for review/distribution and has not been published to a website.
