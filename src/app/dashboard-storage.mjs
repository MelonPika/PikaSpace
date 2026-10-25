// Keep a durable local copy before attempting Chrome sync's small per-item quota.
// This module has no timers or browser globals so storage failures can be tested.
export function createDashboardStorage(api, webStorage, onStatus = (_message) => {}) {
  const key = "pikanav:data";
  const fallbackRead = (name) => {
    const raw = webStorage?.getItem(name);
    return raw == null ? undefined : JSON.parse(raw);
  };
  async function read(name, area = "local") {
    if (!api?.storage?.[area]) return fallbackRead(name);
    try {
      const value = await new Promise((resolve, reject) => {
        api.storage[area].get(name, (result) => {
          const error = api.runtime?.lastError;
          if (error) reject(new Error(error.message));
          else resolve(result?.[name]);
        });
      });
      // A failed earlier Chrome write may have left a newer recovery copy here.
      try { return fallbackRead(name) ?? value; }
      catch { return value; } // A corrupt/inaccessible recovery copy cannot hide a valid Chrome value.
    } catch (error) {
      const fallback = fallbackRead(name);
      if (fallback !== undefined) return fallback;
      throw error;
    }
  }
  async function write(name, value, area = "local") {
    try {
      if (!api?.storage?.[area]) {
        if (!webStorage) throw new Error("Storage unavailable");
        webStorage.setItem(name, JSON.stringify(value));
        return;
      }
      await new Promise((resolve, reject) => {
        api.storage[area].set({ [name]: value }, () => {
          const error = api.runtime?.lastError;
          if (error) reject(new Error(error.message));
          else resolve();
        });
      });
      try { webStorage?.removeItem(name); } catch { /* Chrome has the durable copy. */ }
    } catch (error) {
      if (area === "sync") throw error;
      try {
        if (!webStorage) throw error;
        webStorage.setItem(name, JSON.stringify(value));
        onStatus("Chrome storage is unavailable. Saved a recovery copy on this device.");
      } catch {
        onStatus("Changes could not be saved. Export a backup before closing this tab.");
        throw error;
      }
    }
  }
  async function loadDashboard() {
    const [local, sync] = await Promise.allSettled([read(key), read(key, "sync")]);
    const localValue = local.status === "fulfilled" ? local.value : undefined;
    const syncValue = sync.status === "fulfilled" ? sync.value : undefined;
    if (!localValue && !syncValue && (local.status === "rejected" || sync.status === "rejected")) {
      throw new Error("Saved settings could not be read. Reload to retry; existing data has been kept.");
    }
    const latest = Number(localValue?._pikanavSavedAt || 0) >= Number(syncValue?._pikanavSavedAt || 0)
      ? localValue ?? syncValue ?? {} : syncValue;
    if (latest === syncValue && latest && typeof latest === "object") {
      // Persist synced settings once, without creating a new revision.
      try { await write(key, latest); } catch { /* Existing sync data remains intact. */ }
    }
    return latest;
  }
  async function syncDashboard(data) {
    if (!api?.storage?.sync) return;
    const limit = api.storage.sync.QUOTA_BYTES_PER_ITEM || 8192;
    if (new TextEncoder().encode(key + JSON.stringify(data)).length > limit) {
      onStatus("Saved on this device. This collection is too large for Chrome sync; use Export settings to move it.");
      return;
    }
    try { await write(key, data, "sync"); }
    catch { onStatus("Saved on this device. Chrome sync is unavailable; use Export settings for a backup."); }
  }
  return { read, write, loadDashboard, syncDashboard };
}
