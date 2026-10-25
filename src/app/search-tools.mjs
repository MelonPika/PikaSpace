// Public UI destinations only. No private upload endpoints or cross-site DOM automation.
export const IMAGE_SEARCH_PROVIDERS = {
  google: { label: "Google Images / Lens", url: "https://images.google.com/", action: "Continue to Google Images" },
  bing: { label: "Bing Visual Search", url: "https://www.bing.com/images", action: "Continue to Bing Images" },
};

export function validateSearchImage(file) {
  if (!file) return "Choose an image first.";
  const type = String(file.type || "").toLowerCase();
  if (!(type ? ["image/png", "image/jpeg", "image/webp"].includes(type) : /\.(png|jpe?g|webp)$/i.test(file.name || ""))) return "Choose a PNG, JPG, or WebP image.";
  if (!file.size) return "This image is empty. Choose another file.";
  return file.size > 10 * 1024 * 1024 ? "Choose an image smaller than 10 MB." : "";
}

export function voiceErrorMessage(code) {
  if (["not-allowed", "service-not-allowed", "NotAllowedError", "SecurityError"].includes(code)) return "Microphone or speech-service access was denied. Allow microphone access in Chrome's site settings for this extension, then try again. Your browser or administrator may also restrict speech recognition.";
  if (["audio-capture", "NotFoundError", "NotReadableError", "AbortError"].includes(code)) return "The microphone is unavailable. Connect it, check system microphone permissions, and close other apps using it before retrying.";
  if (code === "network") return "The browser's speech service could not connect. Check your connection, or type your search instead.";
  if (code === "language-not-supported") return "The browser's speech service does not support this language. Change the interface language or type your search.";
  if (code === "no-speech") return "No speech was detected. Try again, or type your search instead.";
  if (code === "unsupported") return "Voice recognition is not supported in this browser. Use a browser with Web Speech recognition, or type your search.";
  if (code === "timeout") return "Voice search timed out. Dismiss any open permission prompt and try again, or type your search.";
  return "Voice recognition could not finish. Try again, or type your search instead.";
}

// Owns exactly one permission/recognition attempt. Invalidating an attempt also
// prevents late permission grants and late recognition callbacks from restarting it.
export function createVoiceController({ Recognition, getUserMedia, onState, onText, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let epoch = 0;
  let recognition = null;
  let timer;
  let active = false;
  let stopping = false;
  let disposed = false;
  function release() {
    clearTimer(timer);
    const current = recognition;
    recognition = null;
    if (current) {
      current.onstart = current.onresult = current.onerror = current.onend = null;
      try { current.abort(); } catch { /* Already ended. */ }
    }
  }
  function finish(state) {
    epoch++;
    active = false;
    stopping = false;
    release();
    if (!disposed) onState(state);
  }
  const fail = code => finish({ phase: "error", message: voiceErrorMessage(code), transcript: "" });
  return {
    async start(language) {
      if (disposed || active) return;
      if (!Recognition) { fail("unsupported"); return; }
      release();
      const attempt = ++epoch;
      active = true;
      stopping = false;
      onState({ phase: "requesting", message: "Allow microphone access if Chrome asks…", transcript: "" });
      timer = setTimer(() => fail("timeout"), 30000);
      try {
        // Request microphone access from this extension page, then immediately
        // release the permission-check stream. SpeechRecognition owns capture.
        if (getUserMedia) {
          const stream = await getUserMedia({ audio: true });
          for (const track of stream.getTracks()) track.stop();
        }
        if (disposed || attempt !== epoch) return;
        const current = new Recognition();
        recognition = current;
        current.lang = language;
        current.continuous = false;
        current.interimResults = true;
        current.maxAlternatives = 1;
        current.onstart = () => {
          if (attempt === epoch) onState({ phase: "listening", message: "Listening… Speak your search.", transcript: "" });
        };
        current.onresult = event => {
          if (attempt !== epoch) return;
          const results = Array.from(event.results || []);
          const transcript = results.map(result => String(result[0]?.transcript || "").trim()).filter(Boolean).join(" ");
          const finalText = results.filter(result => result.isFinal).map(result => String(result[0]?.transcript || "").trim()).filter(Boolean).join(" ");
          if (finalText) {
            finish({ phase: "complete", message: "Speech recognized. Review the text before searching.", transcript: finalText });
            if (!disposed) onText(finalText);
          } else onState({ phase: stopping ? "stopping" : "listening", message: stopping ? "Finishing recognition…" : "Listening… Speak your search.", transcript });
        };
        current.onerror = event => { if (attempt === epoch) fail(event.error); };
        current.onend = () => { if (attempt === epoch) fail("no-speech"); };
        current.start();
      } catch (error) { if (!disposed && attempt === epoch) fail(error?.name); }
    },
    stop() {
      if (!recognition || !active || stopping) return;
      stopping = true;
      onState({ phase: "stopping", message: "Finishing recognition…", transcript: "" });
      clearTimer(timer);
      timer = setTimer(() => fail("no-speech"), 3000);
      try { recognition.stop(); } catch { fail("aborted"); }
    },
    cancel() { finish({ phase: "idle", message: "Listening stopped. Start again when ready.", transcript: "" }); },
    dispose() { disposed = true; epoch++; active = false; release(); },
  };
}
