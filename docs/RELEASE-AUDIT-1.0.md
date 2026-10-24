# PikaNav 1.0.0 — final audit and release report

Historical note (25 October 2026): the source snapshot and verification files referenced below were consolidated into the ZIPs listed in [archive documentation](archive/README.md). The companion source now lives under `companion/`; the original release artifacts remain unchanged. Paths elsewhere in this report describe the layout at audit time.

Date: **24 October 2026** (Asia/Singapore). Status: **READY WITH LIMITATIONS**.

The portable Chrome release is built and verified. Public store submission still needs the publisher's policy URL, contact/listing assets, remaining manual checks, and explicit approval. Nothing was uploaded, submitted, or published.

## Scope and preservation

The existing React/Vite new-tab dashboard, aurora glass identity, widgets, and optional Windows integrations were retained. This was a finalization, not a rebuild. The original 0.2.0 release is unchanged. A pre-edit source snapshot is in `.verification/before-1.0/`.

The audit covered the active application, worker, media injection/control, persistence, network requests, styling/responsiveness, manifest, icons, dependencies, build/packaging, existing tests, native host, and diagnostic extension. Syntax checks cover all application/prototype JavaScript and TypeScript files. Active-runtime type checking is deliberately separate from the unused prototype UI components, whose optional libraries are not installed or bundled.

## Findings and fixes

No Critical defect was confirmed. Severity reflects impact in this project, not a claim that every dependency advisory was exploitable in the packaged extension.

| Severity | Confirmed finding | Resolution |
| --- | --- | --- |
| High | A single sync item could exceed Chrome's per-item quota, silently losing preference/favorite edits. | Durable local mirror first; quota-aware sync; visible fallback/error messages. |
| High | Imported invalid enums, locale/type values, and malformed favorites could crash rendering. | Validate known settings, numeric ranges, arrays, URLs, coordinates, and backup shape/size; normalize duplicate favorite IDs. |
| High | Storage read failures could load defaults and subsequently overwrite saved data; writes could fail without useful feedback. | Read failures preserve existing data; recover locally where possible; report failure; unchanged startup data is not rewritten. |
| High | Existing development dependency tree contained five High and one Moderate advisory-affected packages. | Vite 6.3.5 → 6.4.5 and compatible transitive patches; fresh `npm ci` succeeds and audit reports zero known vulnerabilities. No React major migration. |
| High | Backups omitted widget content/order, profile/avatar, and selected weather location. | Export/import includes those fields and dormant events, while retaining the previous backup format. Actual JSON download/import tested. |
| Medium | Calendar overview requested tokens/events and refreshed periodically independently of its widget. | All Calendar runtime/UI/notification/polling code removed from the entry graph; OAuth, identity permission, scopes and API hosts removed. |
| Medium | Translate was visible but had no action. | Opens Google Translate; tested with Downloads, History, and actual new-tab override. |
| Medium | Enter ignored the keyboard-selected suggestion; late responses could replace newer results. | Submit selected option; ignore aborted responses; bound the cache. |
| Medium | Search queries could be sent to Google while a different suggestion provider was selected; URLs could be sent for suggestions. | No cross-provider fallback; no Perplexity autocomplete endpoint; recognized website addresses bypass autocomplete. |
| Medium | Profile language changed stored profile data without applying the dashboard language. | Apply the chosen locale to dashboard preferences; French/English profile flow tested. |
| Medium | Disabled widgets still performed media/system/weather work. | Gate polling on loaded preferences, visibility, and active consumers; disabled weather/news refresh checks pass. |
| Medium | Tasks after the sixth entry were hidden; adding past capacity silently dropped older tasks. | Scroll the complete list; explicit 100-task capacity with disabled addition at the limit. Eighth-task controls tested. |
| Medium | Narrow settings navigation overflowed horizontally and content scrolling lacked a bounded grid row. | Compact navigation grid, bounded content row, internal scrolling; screenshots/bounds verified. |
| Medium | Weather/news failures had no immediate recovery action; empty news looked like a failed service. | Retry controls and separate empty/error states. Offline failure and recovery tested with fixtures. |
| Medium | Missing native numeric values became fabricated zeroes; raw artwork allowance could exceed native-message size after base64 expansion. | Preserve null metrics; lower artwork allowance and guard final serialized response size. Companion rebuild/protocol reads pass. |
| Medium | Worker had no explicit sender-origin check for privileged requests. | Require this extension's ID and extension-page URL; command allowlist retained. |
| Low | Unlabelled switches/ranges, missing dialog semantics/focus containment, and mouse-only reorder. | Accessible names, focus indicators, dialog focus management, profile dialog semantics, and Alt+arrow reorder. |
| Low | Repeated media requests scanned the same tabs; every tab was scanned after finding playback. | Share in-flight reads; prioritize audible tabs; stop after finding playing media. |
| Low | UI showed an unrelated beta version; only portable-layout ZIP was produced; bundled license notices were incomplete. | Version 1.0.0 throughout; separate store-root ZIP; full runtime dependency notices included. |
| Low | Unused prototype screens/UI components and reference styles coexist with the active dashboard. | Retained as source design references, excluded from the runtime import graph. Their dependencies were not added. |

## Calendar and user data

There is no Calendar widget, settings entry, navigation, event summary, event notification, Google sign-in, OAuth client, Calendar scope, Calendar host permission, token request, API request, or refresh timer in Version 1.0. The clock/date widget remains.

Original Calendar code and dedicated styling are preserved under `future-features/calendar/` with disabled source extensions. They are not shipped or imported. Existing event data, legacy widget preferences, and calendar-selection storage are retained. Backups preserve dormant events. No user token revocation, account change, or Calendar data deletion was performed.

## Executed verification

All Pass labels below refer to executed checks. External-service fixtures verify application behavior, not live service uptime.

| Check/feature | Result and evidence |
| --- | --- |
| Baseline | Original 12 media tests, production build, and original manifest validation passed before edits. |
| Clean dependency installation | `npm ci` passed. |
| Source lint | `npm run lint` passed: 71 JS/TS files parsed, JSON parsed, selected production hazards checked. This is a lightweight source validator, not ESLint. |
| Type checking | `npm run typecheck` passed for the active application/storage/configuration. |
| Regression suite | **28/28 passed**: 6 worker, 14 media, and 8 storage tests. |
| Production/package pipeline | `npm run package` passed: lint, regressions, type check, build, manifest/icons/assets/runtime content validation, both ZIPs. |
| Dependency advisories | `npm audit --json`: **0 known vulnerabilities** on this date. |
| Fresh packaged Chrome installation | Passed through CDP `Extensions.loadUnpacked` in a disposable profile, with no local server required for the dashboard. Actual new-tab override passed. |
| Main Chrome browser suite | **27 named dashboard checks passed** on **Chrome 156.0.8078.47**, plus real browser media integration. Zero captured `Runtime.exceptionThrown` events. |
| Settings/appearance/profile | Light/dark selection; malformed preference recovery; profile name/avatar upload; profile French/English; settings Japanese/English; wallpaper upload/preset restoration passed. |
| Favorites/groups | Group creation and favorite add/edit/delete passed. |
| Search/tools | Selected keyboard suggestion navigation, URL suggestion suppression, Translate/Downloads/History/New Tab, and image filename search passed. |
| Widget interactions | Focus hide/restore, programmatic HTML drag/drop handlers, keyboard reorder, notes editing, task add/complete, eighth-task access, and notifications passed. |
| Backups/reset | Downloaded JSON contains avatar, wallpaper, notes/tasks, weather location, profile/order, and dormant events. Import round-trip passed. Confirmed preference reset preserves widget content; backup restores preferences. |
| Persistence/messages/lifecycle | Page refresh, two-tab widget updates, stopped/restarted service worker, and full browser close/restart with the same isolated profile passed. |
| Weather/news/city search | Ready, error, retry recovery, and location selection passed using deterministic responses and simulated disconnected requests. Disabled refreshes generated no new requests. |
| Calendar regression | UI/manifest assertions, no Calendar requests in captured traffic, packaged-runtime forbidden-operation scans, and retained event backup checks passed. |
| Responsive layout | Screenshots/bounds at 1440×1000, 800×600, 720×500 with 2× raster density (200%-equivalent viewport), 390×844, and 320×640 passed. Screenshots inspected; narrow settings overflow corrected. |
| Browser media | Real looping HTML audio in a local fixture, metadata extraction, actual frame/document injection, dashboard pause/resume, unsupported track buttons disabled, closed-tab errors, empty state, and companion-absent state passed. |
| Permission/restricted/error cases | Original manifest offers optional access; denied access and restricted/closed/navigated/discarded targets covered by browser/unit checks. The actual permission prompt acceptance UI remains manual. |
| Media scan workload | Concurrent-read sharing and bounded six-tab batches/early exit covered by regression tests, including a 30-tab mock. This is not a CPU/memory benchmark. |
| Native companion | Release build passed with **0 warnings, 0 errors**. Actual framed stdio ping, system stats, current-media read, unknown command, and malformed JSON checks passed. No registry installation or user playback control performed. |
| ZIP integrity | Independent .NET ZIP reader verified every decompressed entry against packaged source bytes, safe paths, expected entry counts, and manifest at store ZIP root. SHA-256 checksums produced. |

The browser media grant test uses a separate extension clone with explicitly granted HTTP/HTTPS hosts and native messaging removed. The exact production manifest is tested separately without site access. This tests real media APIs while avoiding an unverified claim that an automated click accepted the browser permission prompt.

Evidence: `.verification/dashboard-checks.json`, `results.json`, `runtime-diagnostics.json`, `native-results.json`, `dependency-audit.json`, `package-results.json`, `exported-backup.json`, and the PNG screenshots. Test harnesses are in `tests/`; native smoke checks require building the optional host first.

## Edge result and remaining limitations

**Edge 156.0.4314.42 is provisional.** All 27 dashboard checks and the media flow executed, but the strict suite failed its zero-exception assertion because Edge evaluated `google.timers.load.t.sct - performance.timing.navigationStart` on an extension page where `google` is undefined. The captured script has no source URL and is absent from PikaNav's source/runtime bundle. This appears to be a browser-injected timing probe; that attribution is an inference. No global `google` shim was added. Evidence is in `.verification/edge/runtime-diagnostics.json`. The Edge suite is not reported as a clean Pass.

The following remain **NOT PERFORMED / NOT CERTIFIED**:

- macOS/Linux, older Chrome versions (the manifest minimum remains 106), and other Chromium/browser-policy combinations.
- Interactive Developer mode prompts, optional permission acceptance/revocation dialogs, browser location consent/denial UI, and native browser zoom controls. The 200%-equivalent CSS viewport was tested instead.
- Live provider uptime/quotas and live YouTube, YouTube Music, Spotify, or SoundCloud previous/next behavior. Unit selector fixtures and a real generic HTML player do not certify those changing websites.
- Real microphone/speech recognition, full translation review of every locale, screen-reader audit, physical touch dragging, and a long-running CPU/memory soak test.
- Native host installer/uninstaller registration and full extension-to-registered-host playback control. Native protocol reads were tested directly; user media was not changed. The oversized-artwork guard was code-reviewed/compiled, not exercised with a real oversized media thumbnail.
- Actual Chrome account synchronization across devices, Chrome Web Store review, and public one-click installation.

Browser media cannot cover restricted pages, other profiles/browsers, inaccessible embedded/shadow-only players, or sites without an accessible HTML media element. Desktop media/system stats require the optional Windows companion; unavailable GPU metrics remain null. Some secondary strings remain English in non-English interfaces. Image selection is filename-based search, not reverse-image recognition.

The production dashboard has no toolbar popup or floating host-page widget, and no minimize/expand controls. Those tests are **not applicable** to this architecture. The separate legacy Media MVP popup is a source diagnostic tool, excluded from this release; its interactive UI was not certified.

## Artifacts and readiness

- Unpacked extension: `releases/PikaNav-1.0.0/extension/`
- Portable distribution: `releases/PikaNav-1.0.0.zip`
- Store-layout archive: `releases/PikaNav-1.0.0-chrome-web-store.zip`
- Integrity checksums: `releases/SHA256SUMS-1.0.0.txt`
- User instructions/privacy/release notes: `docs/INSTALL.md`, `docs/PRIVACY.md`, `docs/RELEASE-NOTES.md` (also copied into the portable distribution).
- Publisher requirements: `docs/STORE-PREPARATION.md`

The portable ZIP includes 13 runtime files plus four documentation files. Runtime JavaScript and CSS are minified and self-contained; the package contains no native binaries, Node dependencies, test fixtures, machine-specific server paths, source maps, or personal data. The existing 0.2.0 archive is preserved.

**READY WITH LIMITATIONS** means ready for the verified Windows Chrome unpacked-install path with the documented optional integrations and manual coverage limits. It does not mean store-approved or universally certified. Before public submission, supply the public privacy URL, real support contact and listing assets, complete the remaining targeted manual checks, review disclosures, and obtain explicit owner approval.

Policy/reference review used Google's [Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies), [privacy fields guidance](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), [storage API](https://developer.chrome.com/docs/extensions/reference/api/storage), [native messaging limits](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging), and [Vite's supported releases](https://vite.dev/releases). Recheck applicable policies when submitting.
