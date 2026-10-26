import { normalizeHex, DEFAULT_COLORS } from "./customization.mjs";

// Bundled locally so backgrounds and their previews work without network access.
export const WALLPAPERS = [
  { id: "aurora", label: "Aurora", author: "Priscilla Du Preez", source: "https://unsplash.com/photos/HhCANDrFzZ0" },
  { id: "cosmos", label: "Cosmos", author: "NASA, ESA & STScI", source: "https://unsplash.com/photos/KWLeJjzT1lU" },
  { id: "mountain", label: "Alpine Lake", author: "Luca Bravo", source: "https://unsplash.com/photos/zAjdgNXsMeg" },
  { id: "forest", label: "Forest", author: "Lukasz Szmigiel", source: "https://unsplash.com/photos/jFCViYFYcus" },
  { id: "dunes", label: "Desert Dunes", author: "Diego Jimenez", source: "https://unsplash.com/photos/DV1mP1-H9GU" },
  { id: "coast", label: "Iceland Coast", author: "Jeremy Bishop", source: "https://unsplash.com/photos/190N6i-Rdb0" },
].map(item => ({ ...item, image: `./wallpapers/${item.id}.webp`, thumbnail: `./wallpapers/${item.id}-thumb.webp` }));

export function normalizeWallpaper(value) {
  const legacy = { abstract: "forest", gradient: "coast", "solid-dark": "solid" };
  const id = Object.hasOwn(legacy, value) ? legacy[value] : value;
  return ["solid", "custom", ...WALLPAPERS.map(item => item.id)].includes(id) ? id : "aurora";
}

export function normalizeBackground(value, legacyColor = DEFAULT_COLORS.background) {
  const settings = value && typeof value === "object" ? value : {};
  const color = normalizeHex(settings.wallpaperColor) || normalizeHex(legacyColor) || DEFAULT_COLORS.background;
  let wallpaper = normalizeWallpaper(settings.wallpaper);
  if (!Object.hasOwn(settings, "wallpaperColor") && settings.customSurfaces === true && wallpaper !== "custom") wallpaper = "solid";
  return { wallpaper, wallpaperColor: color };
}
