const statusEl = document.getElementById("connection-status");
const titleEl = document.getElementById("media-title");
const artistEl = document.getElementById("media-artist");
const albumEl = document.getElementById("media-album");
const sourceEl = document.getElementById("media-source");
const playbackEl = document.getElementById("media-playback");
const refreshButton = document.getElementById("refresh-button");
const playPauseButton = document.getElementById("play-pause-button");
const previousButton = document.getElementById("previous-button");
const nextButton = document.getElementById("next-button");
const refreshSystemButton = document.getElementById("refresh-system-button");
const systemStatusEl = document.getElementById("system-status");
const systemCpuEl = document.getElementById("system-cpu");
const systemMemoryEl = document.getElementById("system-memory");
const systemDiskEl = document.getElementById("system-disk");
const systemGpuEl = document.getElementById("system-gpu");

const controlButtons = [refreshButton, playPauseButton, previousButton, nextButton, refreshSystemButton];

document.addEventListener("DOMContentLoaded", () => {
  refreshButton.addEventListener("click", refreshMedia);
  refreshSystemButton.addEventListener("click", refreshSystemStats);
  playPauseButton.addEventListener("click", () => runControlCommand("playPause"));
  previousButton.addEventListener("click", () => runControlCommand("previous"));
  nextButton.addEventListener("click", () => runControlCommand("next"));
  refreshMedia();
  refreshSystemStats();
});

async function refreshMedia() {
  setBusy(true);
  setStatus("Checking companion...", "waiting");

  const ping = await sendMediaCommand("ping");
  if (!ping.ok) {
    showError(ping.error);
    setBusy(false);
    return;
  }

  setStatus(`Companion connected (${ping.version || "unknown version"})`, "ok");
  const media = await sendMediaCommand("getCurrentMedia");
  setBusy(false);

  if (!media.ok) {
    showError(media.error);
    return;
  }

  renderMedia(media);
}

async function runControlCommand(command) {
  setBusy(true);
  const result = await sendMediaCommand(command);
  setBusy(false);

  if (!result.ok) {
    showError(result.error);
    return;
  }

  await refreshMedia();
}

async function refreshSystemStats() {
  setBusy(true);
  setSystemStatus("Loading system stats...", "waiting");

  const stats = await sendMediaCommand("getSystemStats");
  setBusy(false);

  if (!stats.ok) {
    setSystemStatus(stats.error || "Unable to load system stats.", "error");
    renderEmptySystemStats();
    return;
  }

  setSystemStatus("System stats updated.", "ok");
  renderSystemStats(stats);
}

function sendMediaCommand(command) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "mediaCommand", command }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({
          ok: false,
          error: chrome.runtime.lastError.message || "Unable to contact extension service worker."
        });
        return;
      }

      resolve(response && typeof response === "object"
        ? response
        : { ok: false, error: "Extension service worker returned an invalid response." });
    });
  });
}

function renderMedia(media) {
  if (!media.hasSession) {
    setStatus("Companion connected. No active media session found.", "ok");
    setFields({
      title: "-",
      artist: "-",
      album: "-",
      sourceAppUserModelId: "-",
      playbackStatus: "No active session"
    });
    return;
  }

  setFields(media);
}

function setFields(media) {
  titleEl.textContent = media.title || "-";
  artistEl.textContent = media.artist || "-";
  albumEl.textContent = media.album || "-";
  sourceEl.textContent = media.sourceAppUserModelId || "-";
  playbackEl.textContent = media.playbackStatus || "-";
}

function renderSystemStats(stats) {
  systemCpuEl.textContent = formatPercent(stats.cpu?.usagePercent);
  systemMemoryEl.textContent = stats.memory
    ? `${formatMb(stats.memory.usedMb)} / ${formatMb(stats.memory.totalMb)} (${formatPercent(stats.memory.usagePercent)})`
    : "-";
  systemDiskEl.textContent = Array.isArray(stats.disk) && stats.disk.length
    ? stats.disk.map(formatDisk).join("\n")
    : "No fixed disks reported";
  systemGpuEl.textContent = formatGpu(stats.gpu);
}

function renderEmptySystemStats() {
  systemCpuEl.textContent = "-";
  systemMemoryEl.textContent = "-";
  systemDiskEl.textContent = "-";
  systemGpuEl.textContent = "-";
}

function formatDisk(disk) {
  return `${disk.name || "Drive"} ${formatGb(disk.usedGb)} / ${formatGb(disk.totalGb)} (${formatPercent(disk.usagePercent)})`;
}

function formatGpu(gpu) {
  if (!gpu) return "-";

  const usage = gpu.usagePercent == null ? "Usage unavailable" : `Usage ${formatPercent(gpu.usagePercent)}`;
  const memory = gpu.memoryUsedMb == null || gpu.memoryTotalMb == null
    ? "memory unavailable"
    : `${formatMb(gpu.memoryUsedMb)} / ${formatMb(gpu.memoryTotalMb)}`;
  return `${usage}, ${memory}. ${gpu.note || ""}`.trim();
}

function formatPercent(value) {
  return typeof value === "number" ? `${value.toFixed(1)}%` : "-";
}

function formatMb(value) {
  return typeof value === "number" ? `${Math.round(value).toLocaleString()} MB` : "-";
}

function formatGb(value) {
  return typeof value === "number" ? `${value.toFixed(1)} GB` : "-";
}

function showError(error) {
  setStatus(error || "Unable to connect to PikaNav Windows Companion.", "error");
}

function setStatus(message, tone) {
  statusEl.textContent = message;
  statusEl.className = `status status-${tone}`;
}

function setSystemStatus(message, tone) {
  systemStatusEl.textContent = message;
  systemStatusEl.className = `status status-${tone}`;
}

function setBusy(isBusy) {
  controlButtons.forEach((button) => {
    button.disabled = isBusy;
  });
}
