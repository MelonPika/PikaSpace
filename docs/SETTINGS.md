# Settings and customization

Open **Settings** from the dashboard toolbar. Most controls save immediately; layout editing and custom color previews have explicit Save and Cancel actions.

## Layout

Choose **Layout → Edit dashboard layout**. Drag visible widgets, use their up/down buttons, or focus a widget and press Alt + Up/Down. Checkboxes show hidden widgets; the × button hides a widget without deleting its content. Density and search position preview immediately.

**Save layout** commits the preview. **Cancel layout** discards it. **Reset layout** previews the defaults; save to keep them or cancel to retain your arrangement. Widget dimensions adapt to the responsive column; manual resizing and free-form overlapping positions are not supported. “Snap scrolling to widgets” enables scroll snapping, not free-form grid placement.

Layout drafts never write to storage. Saving updates only layout preferences in the existing dashboard settings record and the existing `pikanav.widgetOrder` browser-storage entry. Shortcuts, notes, tasks, weather location, and unrelated preferences are retained. Backups still use version 1 and include widget order. Invalid, duplicate, or unsupported widget IDs are filtered and missing supported widgets are appended.

## Colors

Choose **Appearance → Custom** to reveal native color pickers and HEX fields. Three- and six-digit HEX colors are accepted, with or without `#`. Invalid fields show an error and disable Save. Valid edits preview immediately; **Save colors** commits them, while **Cancel preview**, leaving Appearance, or closing Settings discards the preview.

Choose **Dark**, **Light**, or **Auto** in Appearance. Auto follows system changes immediately and uses the same complete palette as the explicit modes, including menus, dialogs, fields, and widgets. Selecting a theme disables custom card colors so the chosen theme takes effect.

Enable **Use custom card color** to apply an opaque card color with automatic text contrast. Card color and wallpaper are independent; selecting a photo preserves your custom cards. **Reset theme colors** restores the default purple and disables custom cards, preserving the chosen background.

Colors and background choices use the existing local/sync settings record and export/import path. Older custom background settings migrate to Solid color without losing the saved color; uploaded backgrounds remain uploaded backgrounds. Old Abstract and Gradient presets map to Forest and Iceland Coast. Text on solid backgrounds and custom cards chooses black or white automatically, and accent text is adjusted for contrast.

## Wallpaper and solid backgrounds

**Wallpaper** offers six bundled photographs: Aurora, Cosmos, Alpine Lake, Forest, Desert Dunes, and Iceland Coast. Their previews use the same crops as the full images. Both photos and previews work offline, with no wallpaper service requests. Source and license details are available under **Photo credits & licenses** and in the packaged `wallpapers/CREDITS.txt`.

Choose **Solid color** for a background without an image or overlay. Select a preset, use the color picker, or enter a three- or six-digit HEX value and choose **Apply color**. Changing the theme preserves the selected background color. Wallpaper blur and dim controls apply only to photographs and uploaded images; they never alter a solid color.

**Upload custom wallpaper** selects a local image. Switching to a built-in photo or solid background keeps the uploaded image available for later use. Wallpaper choices, colors, blur, and dimming persist after reload and are included in backups.

## About and companion status

**About PikaSpace** reads the installed version from `chrome.runtime.getManifest()`, links to the official repository/releases/issues, and shows companion availability. The repository currently specifies no project license; bundled third-party notices describe their own licenses.

The optional companion is needed for system metrics and Windows desktop media. Browser playback works independently after the user grants site access. See [Companion](COMPANION.md) for installation and connection troubleshooting.

## Verification

`npm test` covers normalization, color contrast, native errors, retry bounds, storage, media, type checks, production build, and stable extension identity. `npm run test:browser` exercises the built extension in disposable Chrome profiles, uses controlled native-transport responses for failure/reconnect states, and uses real browser media APIs. Reports and responsive screenshots are written to `.verification/`. External service fixtures do not certify live weather/news uptime, and headless tests do not visually inspect the operating system's native color-picker dialog.
