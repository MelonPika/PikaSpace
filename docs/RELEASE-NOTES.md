# PikaNav 1.0.1 and Windows Companion 0.2.1

Prepared on 24 October 2026.

- Companion Setup detects existing PikaNav installations across standard Chrome profiles, including older unpacked copies, and skips manual ID entry when it can connect automatically.
- Portable releases now contain a persistent public key and use the stable ID `abipfjhfejgjkhcpilkfdhbgaepljpki`. Setup includes that ID, so it can be installed before the new portable extension.
- **Before switching an existing extension to 1.0.1, export its settings and import them in the new copy.** Chrome stores settings by ID. Updating only the companion works with the existing extension ID and does not require migrating dashboard data.
- Manual pairing remains available for unusual/custom Chrome data locations and diagnostic extensions. Detection reads local preference records and verifies PikaNav files without changing Chrome profile data.
- Detection fixtures, real Chrome profile detection, stable-ID loading, automatic setup, upgrade/repair, uninstall, native protocol, and browser/media regression checks passed. The installer remains unsigned; no public store submission was made.

## PikaNav 1.0.0

Prepared on 24 October 2026. The aurora glass design and new-tab architecture are retained.

- Calendar is postponed: no widget/settings entry, event notifications, sign-in, OAuth permissions, API calls, or refresh timers. Source is preserved separately; dormant event data remains in backups.
- Local-first preferences, quota-aware sync, storage recovery, visible save failures, and cross-tab updates. Opening a tab does not create a fresh revision of unchanged settings.
- Import checks for enums, ranges, types, website URLs, coordinates, wallpaper data, and backup shape/size. The previous backup format remains supported.
- Backups include widget content/order, profile/avatar, and weather location alongside preferences, favorites/groups, and wallpaper.
- Working Translate, keyboard-selected search results, stale suggestion cancellation, bounded suggestion cache, and queries confined to the selected provider.
- Disabled/hidden widgets stop polling. Concurrent music reads share scans; finding a playing session avoids remaining tab scans.
- Accessible control names, keyboard focus, dialog focus containment, keyboard reordering, and narrow-screen settings navigation/scrolling.
- Profile language changes now update the dashboard language. Avatar, wallpaper, preset switching, and image-search upload paths have regression coverage.
- Weather/news retry and empty/error states. Full task list access with explicit 100-task capacity.
- Missing native metrics remain unavailable instead of fabricated zeroes. Worker privileges are restricted to this extension's pages.
- The optional native companion reserves space for base64 artwork and bounds responses to Chrome's native-message limit.
- Consistent version 1.0.0; same-major build security patches; separate portable and store archive layouts with runtime license notices.

Calendar is a future feature. Native desktop media/system stats remain optional Windows integrations. See the release audit for verified coverage and remaining limits; no store submission has been made.
