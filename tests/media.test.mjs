import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { getBrowserMedia, handleMediaCommand, inspectPageMedia } from "../public/media.js";

const playing = { ok: true, hasSession: true, backend: "browser", title: "Browser song", playbackStatus: "Playing" };
const target = { tabId: 2, frameId: 0, documentId: "document-2" };
function browser({ tabs = [], frames = {}, granted = true } = {}) {
  const calls = [];
  return {
    calls,
    permissions: { getAll: async () => ({ origins: granted ? ["http://*/*", "https://*/*"] : [] }), contains: async () => granted },
    tabs: { query: async () => tabs },
    scripting: { executeScript: async (injection) => {
      calls.push(injection);
      const result = frames[injection.target.tabId];
      if (result instanceof Error) throw result;
      return result || [];
    } },
  };
}

test("no companion and no site access gives an empty, actionable browser state", async () => {
  const result = await handleMediaCommand({ command: "getCurrentMedia" }, async () => ({ ok: false, error: "Host missing" }), browser({ granted: false }));
  assert.equal(result.ok, true);
  assert.equal(result.hasSession, false);
  assert.equal(result.requiresBrowserAccess, true);
});

test("playing browser media works without calling the companion", async () => {
  const api = browser({ tabs: [{ id: 2, audible: true }], frames: { 2: [{ frameId: 0, documentId: "document-2", result: playing }] } });
  const result = await handleMediaCommand({ command: "getCurrentMedia" }, () => assert.fail("Native app must not be needed"), api);
  assert.equal(result.title, "Browser song");
  assert.deepEqual(result.target, target);
  assert.equal(result.backend, "browser");
});

test("playing frames outrank paused players; closed and discarded tabs are tolerated", async () => {
  const api = browser({ tabs: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4, discarded: true }], frames: {
    1: [{ frameId: 0, documentId: "one", result: { ...playing, playbackStatus: "Paused" } }],
    2: [{ frameId: 5, documentId: "two", result: playing }],
    3: new Error("Tab closed"),
  } });
  const result = await getBrowserMedia(api);
  assert.equal(result.target.tabId, 2);
  assert.equal(result.target.frameId, 5);
  assert.ok(!api.calls.some((call) => call.target.tabId === 4));
});

test("desktop sessions remain available as a native fallback", async () => {
  const result = await handleMediaCommand({ command: "getCurrentMedia" }, async () => ({ ok: true, hasSession: true, title: "Desktop song" }), browser());
  assert.equal(result.backend, "native");
  assert.equal(result.title, "Desktop song");
});

test("browser controls address the displayed document and do not reach a native player", async () => {
  const api = browser({ frames: { 2: [{ result: playing }] } });
  const result = await handleMediaCommand({ command: "playPause", backend: "browser", target }, () => assert.fail("Wrong backend"), api);
  assert.equal(result.ok, true);
  assert.deepEqual(api.calls[0].target, { tabId: 2, documentIds: ["document-2"] });
  assert.deepEqual(api.calls[0].args, ["playPause"]);
});

test("closed or navigated browser target never falls through to a different app", async () => {
  const api = browser({ frames: { 2: new Error("Document disappeared") } });
  const result = await handleMediaCommand({ command: "next", backend: "browser", target }, () => assert.fail("Must not control desktop"), api);
  assert.equal(result.ok, false);
  assert.match(result.error, /closed, navigated/);
});

test("controls without a displayed backend or document are rejected", async () => {
  for (const message of [{ command: "next" }, { command: "playPause", backend: "browser", target: { tabId: 2, frameId: 0 } }]) {
    const result = await handleMediaCommand(message, () => assert.fail("Must not guess a player"), browser());
    assert.equal(result.ok, false);
  }
});

test("explicit native controls retain the companion protocol", async () => {
  let payload;
  await handleMediaCommand({ command: "previous", backend: "native" }, async (value) => { payload = value; return { ok: true }; }, browser());
  assert.deepEqual(payload, { type: "previous" });
});

function page({ player, metadata, host = "example.com", button } = {}) {
  return vm.runInNewContext(`(${inspectPageMedia.toString()})`, {
    document: { querySelectorAll: () => player ? [player] : [], querySelector: () => button, title: "Page title" },
    location: { hostname: host }, navigator: { mediaSession: { metadata } },
  });
}
function audio() {
  return { currentSrc: "https://example.com/song.mp3", paused: false, ended: false, readyState: 4,
    pause() { this.paused = true; }, async play() { this.paused = false; } };
}

test("page inspection reads Media Session metadata and toggles real player methods", async () => {
  const player = audio();
  const inspect = page({ player, metadata: { title: "Track", artist: "Artist", artwork: [{ src: "https://example.com/cover.png" }] } });
  const paused = await inspect("playPause");
  assert.equal(player.paused, true);
  assert.equal(paused.playbackStatus, "Paused");
  assert.equal(paused.title, "Track");
  assert.equal(paused.artist, "Artist");
  assert.equal(paused.artworkUrl, "https://example.com/cover.png");
  await inspect("playPause");
  assert.equal(player.paused, false);
});

test("generic sites expose play/pause and disable unsupported track controls", async () => {
  const inspect = page({ player: audio() });
  const result = await inspect();
  assert.equal(result.capabilities.playPause, true);
  assert.equal(result.capabilities.next, false);
  assert.equal(result.capabilities.previous, false);
  assert.equal((await inspect("next")).ok, false);
});

test("supported site track controls use available, enabled buttons", async () => {
  let clicked = 0;
  const button = { disabled: false, getAttribute: () => null, getClientRects: () => [1], click: () => clicked++ };
  const inspect = page({ player: audio(), host: "music.youtube.com", button });
  assert.equal((await inspect()).capabilities.next, true);
  await inspect("next");
  assert.equal(clicked, 1);
  button.disabled = true;
  assert.equal((await inspect()).capabilities.next, false);
});

test("missing players and rejected playback return clear states", async () => {
  assert.equal((await page()()).hasSession, false);
  const player = audio();
  player.paused = true;
  player.play = async () => { throw new Error("Autoplay blocked"); };
  const result = await page({ player })("playPause");
  assert.equal(result.ok, false);
  assert.equal(result.error, "Autoplay blocked");
});

test("concurrent widgets share one browser scan", async () => {
  const api = browser({ tabs: [{ id: 2 }], frames: { 2: [{ frameId: 0, documentId: "two", result: playing }] } });
  const [first, second] = await Promise.all([getBrowserMedia(api), getBrowserMedia(api)]);
  assert.equal(first.title, second.title);
  assert.equal(api.calls.length, 1);
});

test("a playing session avoids scanning every remaining tab", async () => {
  const api = browser({ tabs: Array.from({ length: 30 }, (_, index) => ({ id: index + 1 })), frames: { 1: [{ frameId: 0, documentId: "one", result: playing }] } });
  assert.equal((await getBrowserMedia(api)).title, playing.title);
  assert.equal(api.calls.length, 6);
});
