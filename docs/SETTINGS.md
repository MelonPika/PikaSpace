# Settings and customization

Open **Settings** from the dashboard toolbar. Most controls save immediately; layout editing and custom color previews have explicit Save and Cancel actions.

## Layout

Choose **Layout → Edit dashboard layout**. Drag visible widgets, use their up/down buttons, or focus a widget and press Alt + Up/Down. Checkboxes show hidden widgets; the × button hides a widget without deleting its content. Density and search position preview immediately.

**Save layout** commits the preview. **Cancel layout** discards it. **Reset layout** previews the defaults; save to keep them or cancel to retain your arrangement. Widget dimensions adapt to the responsive column; manual resizing and free-form overlapping positions are not supported. “Snap scrolling to widgets” enables scroll snapping, not free-form grid placement.

Layout drafts never write to storage. Saving updates only layout preferences in the existing dashboard settings record and the existing `pikanav.widgetOrder` browser-storage entry. Shortcuts, notes, tasks, weather location, and unrelated preferences are retained. Backups still use version 1 and include widget order. Invalid, duplicate, or unsupported widget IDs are filtered and missing supported widgets are appended.

## Colors

Choose **Appearance → Custom** to reveal native color pickers and HEX fields. Three- and six-digit HEX colors are accepted, with or without `#`. Invalid fields show an error and disable Save. Valid edits preview immediately; **Save colors** commits them, while **Cancel preview**, leaving Appearance, or closing Settings discards the preview.

Enable **Use custom background and card colors** to apply those surfaces. Custom surfaces take priority over the wallpaper preset's base background; a selected custom wallpaper image remains an image layer. Accent presets and saved custom colors share the same CSS tokens. **Reset theme colors** restores the default purple and disables custom surfaces, preserving other settings.

Flat custom backgrounds bypass preset wallpaper overlays so the rendered color matches the contrast calculation. Glass opacity and preset blur/dimming controls are disabled while those flat surfaces are active; **Wallpaper → Use wallpaper backgrounds** restores them. Uploaded wallpaper images retain their existing adjustments.

Colors are normalized into `settings.customColors` (`accent`, `background`, `card`); `settings.customSurfaces` enables surface overrides. These optional additions use the existing local/sync storage and export/import path. Existing backups without them load defaults; an older fixed Custom accent retains its magenta color. Text on custom surfaces and filled accent controls chooses black or white automatically; accent text is adjusted for contrast. Custom cards use opaque surfaces to keep contrast predictable. Independent secondary-accent and arbitrary text-color controls are not exposed.

## About and companion status

**About PikaSpace** reads the installed version from `chrome.runtime.getManifest()`, links to the official repository/releases/issues, and shows companion availability. The repository currently specifies no project license; bundled third-party notices describe their own licenses.

The optional companion is needed for system metrics and Windows desktop media. Browser playback works independently after the user grants site access. See [Companion](COMPANION.md) for installation and connection troubleshooting.

## Verification

`npm test` covers normalization, color contrast, native errors, retry bounds, storage, media, type checks, production build, and stable extension identity. `npm run test:browser` exercises the built extension in disposable Chrome profiles, uses controlled native-transport responses for failure/reconnect states, and uses real browser media APIs. Reports and responsive screenshots are written to `.verification/`. External service fixtures do not certify live weather/news uptime, and headless tests do not visually inspect the operating system's native color-picker dialog.
