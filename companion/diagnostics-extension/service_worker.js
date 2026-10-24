const NATIVE_HOST_NAME = "com.pikanav.media";
const HOST_MISSING_MESSAGE = "PikaNav Windows Companion is not installed or not registered.";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "mediaCommand") {
    return false;
  }

  callNativeHost({ type: message.command })
    .then((response) => sendResponse(response))
    .catch((error) => sendResponse({
      ok: false,
      error: normalizeNativeError(error)
    }));

  return true;
});

async function callNativeHost(payload) {
  return await new Promise((resolve) => {
    let port;

    try {
      port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
    } catch (error) {
      resolve({ ok: false, error: normalizeNativeError(error) });
      return;
    }

    let didRespond = false;

    port.onMessage.addListener((response) => {
      didRespond = true;
      resolve(response && typeof response === "object"
        ? response
        : { ok: false, error: "Native host returned an invalid response." });
      port.disconnect();
    });

    port.onDisconnect.addListener(() => {
      if (didRespond) return;
      resolve({
        ok: false,
        error: normalizeNativeError(chrome.runtime.lastError)
      });
    });

    try {
      port.postMessage(payload);
    } catch (error) {
      resolve({ ok: false, error: normalizeNativeError(error) });
      port.disconnect();
    }
  });
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

  return message || "Unable to connect to PikaNav Windows Companion.";
}
