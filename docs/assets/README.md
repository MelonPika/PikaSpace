# README visual assets

Captured on 25 October 2026 from the unmodified PikaSpace 1.0.0 extension in Chrome, using a disposable profile and the normal settings interface.

| File | Capture |
| --- | --- |
| [dashboard.webp](dashboard.webp) | English dashboard, dark theme, clock, notes, tasks, and the built-in favorites. |
| [settings-zh.webp](settings-zh.webp) | Simplified Chinese appearance settings with the light theme selected. |

Both images are 1600 × 1120 WebP captures at quality 90. They total less than 100 KB. Notes and tasks are example content entered through the UI; the captures contain no personal user data. Media sessions, metrics, network results, and interface elements were not mocked or composited.

The logo source is the user-supplied [pikaspace-mascot.png](pikaspace-mascot.png), retained byte-for-byte at 1254 × 1254 pixels with its original alpha transparency. [mascot-256.png](mascot-256.png) is a resized derivative for README presentation. The artwork is not redrawn.

To refresh the images, load a current build into an isolated Chrome profile, configure the shown widgets through Settings, enter example notes/tasks, and capture the dashboard and appearance panel. Keep the original aspect ratio and check text legibility after compression.

## Theme-aware wordmarks

- [wordmark-light.svg](wordmark-light.svg): dark lettering for light GitHub themes.
- [wordmark-dark.svg](wordmark-dark.svg): light lettering for dark GitHub themes.

These self-contained SVG wordmarks embed the supplied mascot PNG and use system-font fallbacks for the text. They contain no scripts, external images, or remote fonts. These optional wordmarks remain available for other project materials. The English and Chinese READMEs use the mascot PNG directly in a simple centered header.

## Regenerating the brand assets

Run the existing icon generator from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-icons.ps1
```

It creates transparent PNG icons at 16, 32, 48, 64, and 128 pixels, the 256-pixel README derivative, the existing SVG compatibility files, and both wordmarks. The SVG icon files are raster containers of the same artwork. The original source PNG stays unchanged. The extension manifest still uses its existing 16/48/128 icon paths and stable identity.
