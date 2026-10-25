export const DEFAULT_COLORS = { accent: "#8b5cf6", background: "#050911", card: "#0a101e" };
export const WIDGET_IDS = ["clock", "music", "system", "weather", "notes", "tasks", "news"];

export function normalizeHex(value) {
  if (typeof value !== "string") return null;
  const hex = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(hex)) return `#${[...hex].map(c => c + c).join("").toLowerCase()}`;
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toLowerCase()}` : null;
}
export function normalizeColors(value) {
  return Object.fromEntries(Object.entries(DEFAULT_COLORS).map(([key, fallback]) => [key, normalizeHex(value?.[key]) || fallback]));
}
export function normalizeWidgetOrder(value) {
  const ordered = Array.isArray(value) ? [...new Set(value.filter(id => WIDGET_IDS.includes(id)))] : [];
  return [...ordered, ...WIDGET_IDS.filter(id => !ordered.includes(id))];
}
function rgb(hex) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
export function luminance(hex) {
  const [r, g, b] = rgb(hex).map(v => { const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; });
  return .2126 * r + .7152 * g + .0722 * b;
}
export function contrastText(hex) { return luminance(hex) > .179 ? "#000000" : "#ffffff"; }
export function readableAccent(hex, light, backgroundHex) {
  // Accent text sits on neutral surfaces; adjust only its text token to >=4.5:1.
  let channels = rgb(hex);
  const background = backgroundHex ? luminance(backgroundHex) : light ? .9 : .007;
  for (let i = 0; i < 32; i++) {
    const color = `#${channels.map(c => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
    const l = luminance(color);
    if ((Math.max(l, background) + .05) / (Math.min(l, background) + .05) >= 4.5) return color;
    channels = channels.map(c => light ? c * .88 : c + (255 - c) * .12);
  }
  return light ? "#050911" : "#ffffff";
}
