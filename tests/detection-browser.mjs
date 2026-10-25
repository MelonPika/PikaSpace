import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';
import { extensionIdFromKey } from '../scripts/extension-identity.mjs';

const work = path.resolve('.verification/companion');
await mkdir(work, { recursive: true });
const profile = await mkdtemp(path.join(work, 'browser-detection-'));
const detector = path.join(work, 'detector/PikaNav.ExtensionDetector.exe');
const output = path.join(work, 'browser-detected-ids.txt');
const executable = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = spawn(executable, ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', '--enable-unsafe-extension-debugging', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const exited = once(browser, 'exit');
let socket;
let sequence = 0;
const pending = new Map();
async function poll(fn) {
  for (let i = 0; i < 80; i++) {
    const value = await fn();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Browser detection test timed out');
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 10000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
try {
  const endpoint = await poll(async () => { try { return await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8'); } catch { return null; } });
  const [port, suffix] = endpoint.trim().split(/\r?\n/);
  socket = new WebSocket(`ws://127.0.0.1:${port}${suffix}`);
  await once(socket, 'open');
  socket.addEventListener('message', event => {
    const value = JSON.parse(event.data);
    const request = pending.get(value.id);
    if (!request) return;
    pending.delete(value.id);
    clearTimeout(request.timer);
    if (value.error) request.reject(new Error(JSON.stringify(value.error)));
    else request.resolve(value.result);
  });
  const stable = await send('Extensions.loadUnpacked', { path: path.resolve('dist') });
  const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
  assert.equal(stable.id, extensionIdFromKey(manifest.key));
  await send('Browser.close');
  await exited;
  const detected = spawnSync(detector, ['--user-data-dir', profile, '--output', output], { windowsHide: true });
  if (detected.error) throw detected.error;
  assert.equal(detected.status, 0);
  assert.equal(await readFile(output, 'utf8'), stable.id);
  const result = { realChromeProfiles: 'passed', stableId: stable.id, currentReleaseDetection: 'passed', nativeRegistration: 'untouched' };
  await writeFile(path.join(work, 'browser-detection-results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  socket?.close();
  for (const request of pending.values()) clearTimeout(request.timer);
  if (browser.exitCode === null) { browser.kill(); await exited; }
  assert.equal(path.dirname(profile), work, 'Browser test cleanup must stay in its workspace');
  await rm(profile, { recursive: true, force: true });
}
