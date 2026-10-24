# Calendar — postponed beyond 1.0

The original Calendar implementation and its overview polling are preserved here as source references with `.disabled` extensions. These files are outside the application entry graph, are not runnable modules, and are never shipped. Calendar's CSS is preserved alongside them.

Version 1.0 has no Calendar widget, settings entry, event summary, event notifications, Google identity permission, OAuth client, Calendar host permissions, token operations, or Calendar refresh timers. The clock and date widget remains available.

Existing `widgetData.events`, legacy widget preferences, and the local `pikanav.googleCalendarIds` key are retained. They are dormant. Import/export keeps event data. No token revocation or deletion of the user's Calendar data is performed during upgrade.

Future implementation must restore types/imports and review this reference before use. It requires fresh OAuth/store configuration, permission review, cancellation handling, and its own complete test coverage. Preserving source does not certify the postponed feature as release-ready.
