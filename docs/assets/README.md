# README visual assets

Captured on 25 October 2026 from the unmodified PikaDesk · 皮卡桌面 1.0.1 extension in Chrome, using a disposable profile and the normal settings interface.

| File | Capture |
| --- | --- |
| [dashboard.webp](dashboard.webp) | English dashboard, dark theme, clock, notes, tasks, and the built-in favorites. |
| [settings-zh.webp](settings-zh.webp) | Simplified Chinese appearance settings with the light theme selected. |

Both images are 1600 × 1120 WebP captures at quality 90. They total less than 100 KB. Notes and tasks are example content entered through the UI; the captures contain no personal user data. Media sessions, metrics, network results, and interface elements were not mocked or composited.

The existing logo is reused from [public/icons/icon-128.svg](../../public/icons/icon-128.svg). The light and dark wordmarks compose this same icon geometry with the English and Chinese product names. No replacement logo or generated dashboard image is used.

To refresh the images, load a current build into an isolated Chrome profile, configure the shown widgets through Settings, enter example notes/tasks, and capture the dashboard and appearance panel. Keep the original aspect ratio and check text legibility after compression.

## Theme-aware wordmarks

- [wordmark-light.svg](wordmark-light.svg): dark lettering for light GitHub themes.
- [wordmark-dark.svg](wordmark-dark.svg): light lettering for dark GitHub themes.

These self-contained vector assets use the existing project icon and system-font fallbacks. They contain no scripts, external images, or remote fonts. The README selects the suitable variant with a standard picture element; the light variant is the fallback.
