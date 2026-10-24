// This function is serialized by chrome.scripting; keep it self-contained.
export async function inspectPageMedia(command = "getCurrentMedia") {
  const elements = [...document.querySelectorAll("audio, video")]
    .filter((element) => element.currentSrc || element.src || element.srcObject);
  const player = elements.find((element) => !element.paused && !element.ended)
    || elements.find((element) => !element.ended && element.readyState > 0);
  if (!player) return { ok: true, hasSession: false };

  const host = location.hostname;
  const selectors = host === "music.youtube.com"
    ? { previous: ".previous-button", next: ".next-button" }
    : /(^|\.)youtube\.com$/.test(host)
      ? { previous: ".ytp-prev-button", next: ".ytp-next-button" }
      : host === "open.spotify.com"
        ? { previous: '[data-testid="control-button-skip-back"]', next: '[data-testid="control-button-skip-forward"]' }
        : /(^|\.)soundcloud\.com$/.test(host)
          ? { previous: ".skipControl__previous", next: ".skipControl__next" }
          : {};
  const getButton = (action) => {
    const button = selectors[action] && document.querySelector(selectors[action]);
    return button && !button.disabled && button.getAttribute("aria-disabled") !== "true"
      && button.getClientRects().length ? button : null;
  };

  try {
    if (command === "playPause") {
      if (player.paused || player.ended) await player.play();
      else player.pause();
    } else if (command === "previous" || command === "next") {
      const button = getButton(command);
      if (!button) return { ok: false, error: "This site does not expose that track control. Use its player instead." };
      button.click();
    }
  } catch (error) {
    return { ok: false, error: error?.message || "The site's player rejected this control. Start playback in its tab first." };
  }

  const metadata = navigator.mediaSession?.metadata;
  const artwork = metadata?.artwork?.find((item) => item.src)?.src || "";
  return {
    ok: true,
    hasSession: true,
    backend: "browser",
    title: String(metadata?.title || document.title || "Untitled track").slice(0, 500),
    artist: String(metadata?.artist || "").slice(0, 500),
    album: String(metadata?.album || "").slice(0, 500),
    sourceAppUserModelId: host,
    playbackStatus: player.paused || player.ended ? "Paused" : "Playing",
    artworkUrl: artwork.length <= 2_000_000 && /^(https?:|data:image\/)/i.test(artwork) ? artwork : "",
    capabilities: { playPause: true, previous: Boolean(getButton("previous")), next: Boolean(getButton("next")) },
  };
}

export const BROWSER_MEDIA_ORIGINS = ["http://*/*", "https://*/*"];

const pendingReads = new WeakMap();
export async function getBrowserMedia(api = chrome) {
  if (pendingReads.has(api)) return pendingReads.get(api);
  const read = inspectBrowserTabs(api);
  pendingReads.set(api, read);
  try { return await read; }
  finally { pendingReads.delete(api); }
}

async function inspectBrowserTabs(api) {
  const permissions = await api.permissions.getAll();
  const origins = (permissions.origins || []).filter((origin) => /^https?:/.test(origin) || origin === "<all_urls>");
  // Only inspect sites the user has granted. Chrome also enforces each frame's access.
  const tabs = origins.length ? await api.tabs.query({ url: origins }) : [];
  tabs.sort((a, b) => Number(Boolean(b.audible)) - Number(Boolean(a.audible)) || a.id - b.id);
  const sessions = [];
  for (let start = 0; start < tabs.length; start += 6) {
    await Promise.all(tabs.slice(start, start + 6).filter((tab) => !tab.discarded).map(async (tab) => {
      try {
        const frames = await api.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          world: "MAIN",
          func: inspectPageMedia,
        });
        for (const frame of frames) {
          if (frame.result?.ok && frame.result.hasSession) {
            sessions.push({ ...frame.result, target: { tabId: tab.id, frameId: frame.frameId, documentId: frame.documentId }, audible: Boolean(tab.audible) });
          }
        }
      } catch {
        // Restricted pages, ungranted frames, and tabs closed during polling are skipped.
      }
    }));
    if (sessions.some((session) => session.playbackStatus === "Playing")) break;
  }
  sessions.sort((a, b) => Number(b.playbackStatus === "Playing") - Number(a.playbackStatus === "Playing")
    || Number(b.audible) - Number(a.audible) || a.target.tabId - b.target.tabId || a.target.frameId - b.target.frameId);
  return sessions[0] || {
    ok: true,
    hasSession: false,
    backend: "browser",
    requiresBrowserAccess: !await api.permissions.contains({ origins: BROWSER_MEDIA_ORIGINS }),
  };
}

export async function handleMediaCommand(message, callNativeHost, api = chrome) {
  const { command } = message;
  if (command === "getCurrentMedia") {
    const browser = await getBrowserMedia(api);
    if (browser.hasSession) return browser;
    const native = await callNativeHost({ type: command });
    if (native?.ok && native.hasSession) return { ...native, backend: "native", requiresBrowserAccess: browser.requiresBrowserAccess };
    return { ...browser, note: "Play media in a Chrome tab. Desktop apps require the optional Windows companion." };
  }

  if (message.backend === "browser") {
    const target = message.target;
    if (!Number.isInteger(target?.tabId) || !Number.isInteger(target?.frameId) || !target.documentId) {
      return { ok: false, error: "Refresh the music widget before using its controls." };
    }
    try {
      // Target the document we displayed; never redirect a failed control to another player.
      const frames = await api.scripting.executeScript({
        target: { tabId: target.tabId, documentIds: [target.documentId] },
        world: "MAIN",
        func: inspectPageMedia,
        args: [command],
      });
      const response = frames[0]?.result;
      return response?.hasSession || response?.ok === false
        ? response : { ok: false, error: "This media session ended. Refresh the widget." };
    } catch {
      return { ok: false, error: "The media tab closed, navigated, or its site access was removed." };
    }
  }
  if (message.backend !== "native") return { ok: false, error: "Refresh the music widget before using its controls." };
  return callNativeHost({ type: command });
}
