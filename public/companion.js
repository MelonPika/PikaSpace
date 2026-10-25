// One availability gate for every native consumer. The native host is launched on
// demand by Chrome; its installed-but-not-running state cannot be observed.
export function classifyCompanionError(error) {
  const message = String(error?.message || error || "Unable to communicate with the Windows Companion.");
  if (/access.*(denied|forbidden)|permission|not allowed|forbidden/i.test(message)) return "permission-error";
  if (/specified native messaging host not found|not registered|not installed/i.test(message)) return "not-detected";
  if (/unknown command|unsupported|incompatible|outdated|invalid response|invalid message/i.test(message)) return "incompatible";
  if (/exited|disconnected|broken pipe|closed/i.test(message)) return "disconnected";
  return "communication-error";
}

export function createCompanionClient(request, { now = Date.now, storage } = {}) {
  let status = { state: "unchecked", error: "", version: "", nextRetryAt: 0 };
  let failures = 0;
  let lastRetry = -Infinity;
  let queue = Promise.resolve();
  const pending = new Map();
  // Session storage survives MV3 worker suspension without persisting failures
  // across browser restarts. No user settings or native payloads are changed.
  const restored = storage?.get("pikanav:companion-status").then(data => {
    const saved = data?.["pikanav:companion-status"];
    if (saved && saved.nextRetryAt > now() && saved.nextRetryAt <= now() + 300000) {
      status = saved;
      failures = 1;
    }
  }).catch(() => {}) || Promise.resolve();
  function publish() { void storage?.set({ "pikanav:companion-status": status }).catch(() => {}); }
  function fail(response) {
    failures++;
    status = { ...status, state: classifyCompanionError(response.error), error: String(response.error || "Companion communication failed."), nextRetryAt: now() + Math.min(300000, 60000 * 2 ** Math.min(failures - 1, 3)) };
    publish();
    return { ...response, ok: false, companion: { ...status } };
  }
  async function perform(payload, force) {
    await restored;
    if (force && now() - lastRetry < 3000) return { ok: status.state === "connected", error: status.error, version: status.version, companion: { ...status } };
    if (force && now() - lastRetry >= 3000) { lastRetry = now(); status.nextRetryAt = 0; }
    if (status.nextRetryAt > now()) return { ok: false, error: status.error, companion: { ...status } };
    if (status.state !== "connected" || payload.type === "ping") {
      const ping = await request({ type: "ping" });
      if (!ping?.ok) return fail(ping || { error: "Native host returned an invalid response." });
      if (!/^1\.\d+\.\d+(?:\.\d+)?$/.test(String(ping.version || ""))) return fail({ error: "Incompatible Windows Companion. Install a supported 1.x release." });
      status = { state: "connected", error: "", version: ping.version, nextRetryAt: 0 };
      failures = 0;
      publish();
      if (payload.type === "ping") return { ...ping, companion: { ...status } };
    }
    const response = await request(payload);
    if (!response?.ok) {
      // A valid host can reject a media action without losing its connection.
      if (response && !response.transportError && ["playPause", "next", "previous"].includes(payload.type) && classifyCompanionError(response.error) === "communication-error") return { ...response, companion: { ...status } };
      return fail(response || { error: "Native host returned an invalid response." });
    }
    return { ...response, companion: { ...status } };
  }
  return {
    async snapshot() { await restored; return { ...status }; },
    call(payload, force = false) {
      const key = `${payload.type}:${force}`;
      if (pending.has(key)) return pending.get(key);
      const result = queue.then(() => perform(payload, force)).catch(error => fail({ error: error?.message || String(error) }));
      queue = result.then(() => {});
      pending.set(key, result);
      void result.finally(() => pending.delete(key));
      return result;
    },
  };
}
