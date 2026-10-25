import { handleMediaCommand } from "./media.js";

const NATIVE_HOST_NAME = "com.pikanav.media";
const HOST_MISSING_MESSAGE = "PikaDesk · 皮卡桌面 Windows Companion is not installed or not registered.";

const SUPPORTED_COMMANDS = new Set([
  "ping",
  "getSystemStats",
  "getCurrentMedia",
  "playPause",
  "next",
  "previous",
]);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only our extension pages may invoke privileged native, network, or page controls.
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(""))) return false;
  if (message?.type === "GET_SEARCH_SUGGESTIONS") {
    getSearchSuggestions(message)
      .then((suggestions) => sendResponse({ ok: true, suggestions }))
      .catch((error) => sendResponse({ ok: false, suggestions: [], error: normalizeSuggestionError(error) }));

    return true;
  }

  if (message?.type === "GET_NEWS_FEED") {
    getNewsFeed(message)
      .then((xml) => sendResponse({ ok: true, xml }))
      .catch((error) => sendResponse({ ok: false, error: error?.message || "News feed unavailable" }));
    return true;
  }

  if (message?.type === "GET_SYSTEM_STATS") {
    callNativeHost({ type: "getSystemStats" })
      .then((response) => {
        if (!response?.ok) {
          sendResponse({ ok: false, error: response?.error || "System stats unavailable" });
          return;
        }

        sendResponse({ ok: true, stats: normalizeStats(response), raw: response });
      })
      .catch((error) => sendResponse({ ok: false, error: normalizeNativeError(error) }));

    return true;
  }

  if (message?.type === "PIKANAV_COMPANION_COMMAND" || message?.type === "mediaCommand") {
    const command = message.command;
    if (!SUPPORTED_COMMANDS.has(command)) {
      sendResponse({ ok: false, error: "Unsupported PikaDesk · 皮卡桌面 companion command." });
      return false;
    }

    if (["getCurrentMedia", "playPause", "next", "previous"].includes(command)) {
      handleMediaCommand(message, callNativeHost)
        .then(sendResponse)
        .catch((error) => sendResponse({ ok: false, error: error?.message || "Media unavailable." }));
      return true;
    }

    callNativeHost({ type: command })
      .then((response) => {
        if (command === "getSystemStats" && response?.ok) {
          sendResponse({ ok: true, stats: normalizeStats(response), raw: response });
          return;
        }
        sendResponse(response);
      })
      .catch((error) => sendResponse({ ok: false, error: normalizeNativeError(error) }));

    return true;
  }

  return false;
});

async function getNewsFeed(message) {
  const topic = String(message?.topic || "technology").trim().slice(0, 50);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=en-US&gl=US&ceid=US:en`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`News feed returned ${response.status}`);
    return (await response.text()).slice(0, 250000);
  } finally {
    clearTimeout(timeout);
  }
}

async function getSearchSuggestions(message) {
  const query = String(message?.query || "").trim().slice(0, 500);
  const engine = String(message?.engine || "google");
  if (!query || engine === "perplexity") return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    if (engine === "bing") {
      const response = await fetch(`https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Suggestion service returned ${response.status}`);
      const data = await response.json();
      return normalizeSuggestions(Array.isArray(data?.[1]) ? data[1] : [], query);
    }

    if (engine === "duckduckgo") {
      const response = await fetch(`https://duckduckgo.com/ac/?q=${encodeURIComponent(query)}&type=list`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Suggestion service returned ${response.status}`);
      const data = await response.json();
      const suggestions = normalizeSuggestions(Array.isArray(data) ? data.map((item) => item?.phrase) : [], query);
      return suggestions;
    }

    return await getGoogleSuggestions(query, controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

async function getGoogleSuggestions(query, signal) {
  const response = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`, {
    signal,
  });
  if (!response.ok) throw new Error(`Suggestion service returned ${response.status}`);
  const data = await response.json();
  return normalizeSuggestions(Array.isArray(data?.[1]) ? data[1] : [], query);
}

function normalizeSuggestions(values, query) {
  const seen = new Set();
  const normalized = [];
  const lowerQuery = query.toLowerCase();

  for (const value of values) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    const key = text.toLowerCase();
    if (!text || key === lowerQuery || seen.has(key)) continue;
    seen.add(key);
    normalized.push(text);
    if (normalized.length >= 10) break;
  }

  return normalized;
}

function normalizeSuggestionError(error) {
  if (error?.name === "AbortError") return "Suggestion service timed out.";
  return error?.message || "Suggestion service unavailable.";
}

async function callNativeHost(payload) {
  return await new Promise((resolve) => {
    let port;
    let timeout;
    let settled = false;
    const finish = (response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(response);
      port?.disconnect();
    };

    try {
      port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
    } catch (error) {
      finish({ ok: false, error: normalizeNativeError(error) });
      return;
    }

    timeout = setTimeout(() => finish({ ok: false, error: "Windows companion timed out." }), 5000);

    port.onMessage.addListener((response) => {
      finish(response && typeof response === "object"
        ? response
        : { ok: false, error: "Native host returned an invalid response." });
    });

    port.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError;
      finish({ ok: false, error: normalizeNativeError(error) });
    });

    try {
      port.postMessage(payload);
    } catch (error) {
      finish({ ok: false, error: normalizeNativeError(error) });
    }
  });
}

function normalizeStats(response) {
  const disk = Array.isArray(response?.disk) ? response.disk[0] : undefined;
  return {
    cpu: pickPercent(response?.cpu?.usagePercent),
    ram: pickPercent(response?.memory?.usagePercent),
    disk: pickPercent(disk?.usagePercent),
    gpu: pickPercent(response?.gpu?.usagePercent),
    memoryUsedMb: pickNumber(response?.memory?.usedMb),
    memoryTotalMb: pickNumber(response?.memory?.totalMb),
    diskName: typeof disk?.name === "string" ? disk.name : "",
    diskUsedGb: pickNumber(disk?.usedGb),
    diskTotalGb: pickNumber(disk?.totalGb),
    gpuNote: typeof response?.gpu?.note === "string" ? response.gpu.note : "",
  };
}

function pickPercent(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function pickNumber(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeNativeError(error) {
  const message = typeof error?.message === "string" ? error.message : String(error || "");
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("specified native messaging host not found")
    || lowerMessage.includes("native host has exited")
    || lowerMessage.includes("not found")
    || lowerMessage.includes("not registered")
  ) {
    return HOST_MISSING_MESSAGE;
  }

  return message || "Unable to connect to PikaDesk · 皮卡桌面 Windows Companion.";
}
