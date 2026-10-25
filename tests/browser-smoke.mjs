import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import { extensionIdFromKey } from '../scripts/extension-identity.mjs';

const root = path.resolve('.');
const label = process.env.PIKANAV_VERIFY_LABEL || '';
if (label && !/^[a-z0-9-]+$/.test(label)) throw new Error('Invalid verification label');
const work = path.join(root, '.verification', label);
const extension = path.resolve(process.env.PIKANAV_EXTENSION_PATH || path.join(root, 'dist'));
const profile = path.join(work, `chrome-profile-${Date.now()}`);
const downloads = path.join(work, 'downloads', path.basename(profile));
const clone = path.join(work, 'granted-extension');
await mkdir(work, { recursive: true });
await mkdir(downloads, { recursive: true });
await cp(extension, clone, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(clone, 'manifest.json'), 'utf8'));
manifest.name = 'PikaSpace isolated media test';
// Keep the isolated no-native test copy distinct from the stable-ID release.
delete manifest.key;
manifest.permissions = manifest.permissions.filter(p => p !== 'nativeMessaging');
manifest.host_permissions.push('http://*/*', 'https://*/*');
await writeFile(path.join(clone, 'manifest.json'), JSON.stringify(manifest));

const wave = Buffer.alloc(44 + 48000 * 2 * 3);
wave.write('RIFF', 0); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVEfmt ', 8);
wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22);
wave.writeUInt32LE(48000, 24); wave.writeUInt32LE(96000, 28); wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34);
wave.write('data', 36); wave.writeUInt32LE(wave.length - 44, 40);
for (let i = 0; i < (wave.length - 44) / 2; i++) wave.writeInt16LE(Math.round(Math.sin(i * Math.PI * 880 / 48000) * 2000), 44 + i * 2);
const server = http.createServer((req, res) => {
  if (req.url === '/tone.wav') { res.setHeader('Content-Type', 'audio/wav'); res.end(wave); return; }
  res.setHeader('Content-Type', 'text/html');
  res.end('<!doctype html><title>Independent browser media fixture</title><audio id="player" src="/tone.wav" loop controls></audio><script>navigator.mediaSession.metadata = new MediaMetadata({ title: "Portable media test", artist: "PikaSpace fixture", album: "No companion" });</script>');
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const port = server.address().port;
const executable = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const launchChrome = () => spawn(executable, ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', '--enable-unsafe-extension-debugging', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--lang=en-US', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let child = launchChrome();
let ws;
const pending = new Map();
const events = [];
const runtimeDiagnostics = [];
const diagnosticReads = [];
let sequence = 0;
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
async function poll(fn, description) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const result = await fn();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${description}`);
}
async function evaluate(session, expression, userGesture = false) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture }, session);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}
async function open(url) {
  const { targetId } = await send('Target.createTarget', { url });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId);
  await send('Debugger.enable', {}, sessionId);
  await poll(() => evaluate(sessionId, 'document.readyState === "complete"'), 'page load');
  return { targetId, session: sessionId };
}
try {
  const active = await poll(async () => {
    try { return await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8'); } catch { return false; }
  }, 'Chrome debug endpoint');
  const [debugPort, endpoint] = active.trim().split(/\r?\n/);
  ws = new WebSocket(`ws://127.0.0.1:${debugPort}${endpoint}`);
  await once(ws, 'open');
  const receive = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const item = pending.get(message.id);
      if (!item) return;
      clearTimeout(item.timer); pending.delete(message.id);
      if (message.error) item.reject(new Error(JSON.stringify(message.error)));
      else item.resolve(message.result);
    } else {
      events.push(message);
      if (message.method === 'Runtime.exceptionThrown') {
        const scriptId=message.params.exceptionDetails.scriptId;
        diagnosticReads.push(Promise.allSettled([
          send('Debugger.getScriptSource',{scriptId},message.sessionId),
          send('Runtime.evaluate',{expression:'typeof location === "undefined" ? "unknown" : location.href',returnByValue:true},message.sessionId),
        ]).then(values=>runtimeDiagnostics.push({event:message,values})));
      }
    }
  };
  ws.addEventListener('message', receive);
  console.log('Chrome:', (await send('Browser.getVersion')).product);
  const checks = [];
  const checked = name => { checks.push(name); console.log('PASS:', name); };
  async function click(session, selector) { return evaluate(session, `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('Missing ' + ${JSON.stringify(selector)}); el.click(); return true; })()`, true); }
  async function clickText(session, selector, text) { return evaluate(session, `(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(el => el.textContent.trim() === ${JSON.stringify(text)}); if (!el) throw new Error('Missing text ' + ${JSON.stringify(text)}); el.click(); return true; })()`, true); }
  async function input(session, selector, value) { return evaluate(session, `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error('Missing input'); Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles:true })); return true; })()`); }
  async function key(session, key, extras = {}) { await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, ...extras }, session); await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, ...extras }, session); }
  async function importBackup(session, data, filename = 'pikaspace-settings.json') { return evaluate(session, `(() => { const el = document.querySelector('input[accept="application/json"]'); const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(JSON.stringify(data))}], ${JSON.stringify(filename)}, {type:'application/json'})); el.files = dt.files; el.dispatchEvent(new Event('change', {bubbles:true})); return true; })()`); }
  async function imageUpload(session,selector,name='test.png') { return evaluate(session,`(() => { const el=document.querySelector(${JSON.stringify(selector)}); const canvas=document.createElement('canvas'); canvas.width=2; canvas.height=2; const ctx=canvas.getContext('2d'); ctx.fillStyle='#8b5cf6'; ctx.fillRect(0,0,2,2); const raw=atob(canvas.toDataURL('image/png').split(',')[1]); const dt=new DataTransfer(); dt.items.add(new File([Uint8Array.from(raw,c=>c.charCodeAt(0))],${JSON.stringify(name)},{type:'image/png'})); el.files=dt.files; el.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`); }
  async function select(session,selector,value) { return evaluate(session,`(() => { const el=document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`); }

  const original = await send('Extensions.loadUnpacked', { path: extension });
  const releaseManifest = JSON.parse(await readFile(path.join(extension, 'manifest.json'), 'utf8'));
  if (releaseManifest.key) assert.equal(original.id, extensionIdFromKey(releaseManifest.key), 'Chrome must use the stable release ID');
  assert.match(original.id, /^[a-p]{32}$/);
  let page = await open(`chrome-extension://${original.id}/index.html`);
  await poll(() => evaluate(page.session, 'Boolean(document.querySelector(".music-card"))'), 'dashboard music widget');
  const noAccess = await evaluate(page.session, 'chrome.runtime.sendMessage({type:"mediaCommand",command:"getCurrentMedia"})');
  assert.equal(noAccess.ok, true);
  assert.equal(noAccess.requiresBrowserAccess, true);
  await poll(() => evaluate(page.session, '[...document.querySelectorAll(".music-card button")].some(button => button.textContent === "Enable browser media")'), 'optional media access button');
  console.log('Original portable manifest loads and offers optional site access.');
  assert.equal(await evaluate(page.session, "chrome.runtime.getManifest().name"), "PikaSpace");
  assert.equal(await evaluate(page.session, "document.title"), "PikaSpace");
  assert.equal(await evaluate(page.session, 'document.querySelector(".brand-mark").textContent'), "PikaSpace");
  assert.equal(await evaluate(page.session, 'getComputedStyle(document.querySelector(".brand-mark")).textTransform'), "none");
  checked('fresh installation, product title and no-companion permission state');
  assert.equal(await evaluate(page.session, 'Boolean(chrome.runtime.getManifest().oauth2)'), false);
  assert.equal(await evaluate(page.session, 'chrome.runtime.getManifest().permissions.includes("identity")'), false);
  const workerTarget = (await send('Target.getTargets')).targetInfos.find(target => target.type === 'service_worker' && target.url.startsWith(`chrome-extension://${original.id}/`));
  assert.ok(workerTarget, 'Extension worker exists');
  const { sessionId: workerSession } = await send('Target.attachToTarget', { targetId: workerTarget.targetId, flatten: true });
  await send('Runtime.enable', {}, workerSession);
  const network = [];
  let offline = false;
  // Deterministic external-service fixtures; actual browser media still uses a real HTMLAudioElement.
  const fixture = async event => {
    if (event.method !== 'Fetch.requestPaused') return;
    const url = event.params.request.url;
    network.push(url);
    if (offline && !url.startsWith('http://127.0.0.1')) { await send('Fetch.failRequest', { requestId: event.params.requestId, errorReason: 'InternetDisconnected' }, event.sessionId).catch(() => {}); return; }
    let body = '', type = 'application/json';
    if (url.includes('suggestqueries.google.com')) { const query = new URL(url).searchParams.get('q'); body = JSON.stringify([query, [query + ' first', query + ' second']]); }
    else if (url.startsWith('https://api.open-meteo.com/')) body = JSON.stringify({ current: {temperature_2m:27, relative_humidity_2m:65, apparent_temperature:29, precipitation:0, weather_code:0, wind_speed_10m:8, is_day:1}, daily: {time:['2026-10-24'],weather_code:[0],temperature_2m_max:[29],temperature_2m_min:[24],precipitation_probability_max:[5]} });
    else if (url.includes('geocoding-api.open-meteo.com')) body = JSON.stringify({ results: [{name:'Singapore',country:'Singapore',latitude:1.35,longitude:103.82,timezone:'Asia/Singapore'}] });
    else if (url.includes('news.google.com')) { type = 'application/xml'; body = '<rss><channel><item><title>Test headline - Fixture</title><link>https://example.com/story</link><source>Fixture</source></item></channel></rss>'; }
    else { type = 'text/html'; body = '<title>External destination fixture</title>'; }
    await send('Fetch.fulfillRequest', { requestId: event.params.requestId, responseCode: 200, responseHeaders: [{name:'Content-Type',value:type}], body:Buffer.from(body).toString('base64') }, event.sessionId).catch(() => {});
  };
  ws.addEventListener('message', event => { const message = JSON.parse(event.data); void fixture(message); });
  for (const session of [page.session, workerSession]) await send('Fetch.enable', { patterns:[{ urlPattern:'https://*' }] }, session);
  // Exercise the real worker/UI without modifying the user's native registry or
  // controlling a desktop player. Only the transport boundary is simulated.
  await evaluate(workerSession, `(() => {
    globalThis.savedConnectNative=chrome.runtime.connectNative;
    globalThis.nativeFixture={mode:'missing',calls:0};
    chrome.runtime.connectNative=()=>{
      nativeFixture.calls++;
      let receive;
      return {onMessage:{addListener:fn=>receive=fn},onDisconnect:{addListener:()=>{}},disconnect:()=>{},postMessage:payload=>queueMicrotask(()=>{
        const mode=nativeFixture.mode;
        receive(mode==='connected' ? payload.type==='ping' ? {ok:true,version:'1.0.0'} : payload.type==='getSystemStats' ? {ok:true,cpu:{usagePercent:42},memory:{usagePercent:30},disk:[]} : {ok:true,hasSession:false}
          : mode==='incompatible' ? {ok:true,version:'2.0.0'}
          : {ok:false,error:mode==='missing'?'Specified native messaging host not found.':mode==='disconnected'?'Native host has exited.':mode==='permission'?'Access to the specified native messaging host is forbidden.':'Windows companion timed out.'});
      })};
    };
  })()`);
  await click(page.session, 'button[aria-label="Settings"]');
  await clickText(page.session, '.settings-sidebar nav button', 'About PikaSpace');
  assert.ok(await evaluate(page.session, 'document.querySelector(".about-identity").textContent.includes(chrome.runtime.getManifest().version)'));
  const aboutLinks=await evaluate(page.session,'[...document.querySelectorAll(".about-links a")].map(el=>({href:el.href,target:el.target,rel:el.rel}))');
  assert.deepEqual(aboutLinks.map(link=>link.href), ['https://github.com/MelonPika/PikaSpace','https://github.com/MelonPika/PikaSpace/releases','https://github.com/MelonPika/PikaSpace/issues']);
  assert.ok(aboutLinks.every(link=>link.target==='_blank' && link.rel.includes('noopener')));
  assert.ok(await evaluate(page.session,'document.querySelector(".settings-content").textContent.includes("No project license has been specified")'));
  for (const [mode,state] of [['missing','not-detected'],['disconnected','disconnected'],['permission','permission-error'],['incompatible','incompatible'],['timeout','communication-error'],['connected','connected']]) {
    await evaluate(workerSession, `nativeFixture.mode=${JSON.stringify(mode)}`);
    if(mode!=='missing') await new Promise(resolve=>setTimeout(resolve,3100));
    await clickText(page.session,'.companion-actions button','Retry Connection');
    await poll(async()=> (await evaluate(page.session,'chrome.runtime.sendMessage({type:"COMPANION_STATUS"})')).companion.state===state, `companion ${state}`);
    if(mode==='missing') {
      assert.ok(await evaluate(page.session,'document.querySelector(".companion-notice").textContent.includes("Windows Companion Required")'));
      const before=await evaluate(workerSession,'nativeFixture.calls');
      for(let i=0;i<8;i++) await evaluate(page.session,'chrome.runtime.sendMessage({type:"PIKANAV_COMPANION_COMMAND",command:"getSystemStats"})');
      assert.equal(await evaluate(workerSession,'nativeFixture.calls'),before,'negative cache must suppress retries');
    }
  }
  await click(page.session,'.settings-close');
  await poll(()=>evaluate(page.session,'document.querySelector(".system-card")?.textContent.includes("42%")'),'system stats restored after reconnect');
  checked('About manifest version, safe official links, license disclosure and all observable companion states');
  await evaluate(workerSession,'chrome.runtime.connectNative=savedConnectNative');
  await click(page.session,'button[aria-label="Settings"]');
  await clickText(page.session,'.accent-grid button','Custom');
  await input(page.session,'input[aria-label="accent HEX"]','#123456');
  assert.equal(await evaluate(page.session,'document.querySelector("main").style.getPropertyValue("--accent")'),'#123456');
  const savedColor=await evaluate(page.session,'(async()=> (await chrome.storage.local.get("pikanav:data"))["pikanav:data"]?.settings.customColors.accent)()');
  assert.notEqual(savedColor,'#123456','preview must not persist');
  await input(page.session,'input[aria-label="accent HEX"]','#xyz');
  assert.equal(await evaluate(page.session,'document.querySelector("#color-accent").getAttribute("aria-invalid")'),'true');
  assert.equal(await evaluate(page.session,'[...document.querySelectorAll(".custom-color-editor button")].find(el=>el.textContent==="Save colors").disabled'),true);
  assert.equal(await evaluate(page.session,'document.querySelector("main").style.getPropertyValue("--accent")'),'#123456');
  await clickText(page.session,'.custom-color-editor button','Cancel preview');
  await input(page.session,'input[aria-label="Pick accent color"]','#00aabb');
  assert.equal(await evaluate(page.session,'document.querySelector("main").style.getPropertyValue("--accent")'),'#00aabb');
  await clickText(page.session,'.custom-color-editor button','Save colors');
  await poll(()=>evaluate(page.session,'(async()=> (await chrome.storage.local.get("pikanav:data"))["pikanav:data"]?.settings.customColors.accent === "#00aabb")()'),'custom color persisted');
  await clickText(page.session,'.accent-grid button','Emerald');
  assert.equal(await evaluate(page.session,'document.querySelector("main").style.getPropertyValue("--accent")'),'#10b981');
  await clickText(page.session,'.accent-grid button','Custom');
  assert.equal(await evaluate(page.session,'document.querySelector("main").style.getPropertyValue("--accent")'),'#00aabb');
  await input(page.session,'input[aria-label="card HEX"]','#ffffff');
  await input(page.session,'input[aria-label="background HEX"]','#111827');
  await clickText(page.session,'.custom-color-editor button','Save colors');
  await click(page.session,'.settings-toggle[aria-label="Use custom background and card colors"]');
  assert.equal(await evaluate(page.session,'document.querySelector("main").style.getPropertyValue("--panel-bg")'),'#ffffff');
  assert.equal(await evaluate(page.session,'document.querySelector("main").style.getPropertyValue("--text-primary")'),'#000000');
  assert.equal(await evaluate(page.session,'document.querySelector("main").style.getPropertyValue("--custom-background")'),'#111827');
  assert.equal(await evaluate(page.session,'getComputedStyle(document.querySelector(".clock-large")).color'),'rgb(0, 0, 0)');
  assert.equal(await evaluate(page.session,'getComputedStyle(document.querySelector(".search-bar input")).color'),'rgb(0, 0, 0)');
  await poll(()=>evaluate(page.session,'getComputedStyle(document.querySelector(".icon-button")).backgroundColor === "rgb(255, 255, 255)"'),'custom toolbar color transition');
  await click(page.session,'.settings-close');
  const customShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},page.session);
  await writeFile(path.join(work,'custom-theme.png'),Buffer.from(customShot.data,'base64'));
  await click(page.session,'button[aria-label="Settings"]');
  await clickText(page.session,'.settings-action','Reset theme colors');
  assert.equal(await evaluate(page.session,'document.querySelector("main").style.getPropertyValue("--accent")'),'#8b5cf6');
  await clickText(page.session,'.accent-grid button','Custom');
  await input(page.session,'input[aria-label="accent HEX"]','#09c');
  await clickText(page.session,'.custom-color-editor button','Save colors');
  await click(page.session,'.settings-close');
  await send('Page.reload',{},page.session);
  await poll(()=>evaluate(page.session,'document.querySelector("main")?.style.getPropertyValue("--accent") === "#0099cc"'),'custom color reload');
  checked('custom picker, HEX validation, live preview, save/cancel, presets, reset and reload persistence');
  await click(page.session, 'button[aria-label="Settings"]');
  await clickText(page.session, '.settings-sidebar nav button', 'Widgets');
  assert.equal(await evaluate(page.session, 'document.querySelector(".widget-list").textContent.includes("Calendar")'), false);
  assert.equal(await evaluate(page.session, 'document.querySelectorAll(".widget-list [role=switch]").length'), 7);
  checked('Calendar absent from widget settings and OAuth configuration');
  await clickText(page.session, '.settings-sidebar nav button', 'Data & Backup');
  const backup = { settings: { accentColor:'invalid', fontSize:1000000, language:{ locale:'invalid' }, visibility:{topBarStats:false}, widgets:{clock:true,music:true,system:false,notes:true,tasks:true,weather:false,news:false,calendar:true} }, favorites:[null,{}, {label:123,url:'javascript:alert(1)'}, {label:'Valid imported', url:'https://example.com'}], widgetData:{notes:'Preserved note',tasks:[],events:[{id:'sample-event',title:'Sample event data',date:'2026-10-24'}]}, profile:{displayName:'Pika Tester',locale:'invalid'} };
  await importBackup(page.session, backup);
  await poll(() => evaluate(page.session, 'document.querySelector(".greeting").textContent.includes("Pika Tester")'), 'profile imported');
  assert.equal(await evaluate(page.session, 'document.documentElement.lang'), 'en-US');
  assert.equal(await evaluate(page.session, 'document.querySelectorAll(".calendar-widget").length'), 0);
  assert.equal(await evaluate(page.session, 'document.querySelector(".favorite-grid").textContent.includes("Valid imported")'), true);
  await click(page.session, '.settings-close');
  await poll(() => evaluate(page.session, 'Boolean(document.querySelector(".notes-widget textarea"))'), 'notes enabled');
  assert.equal(await evaluate(page.session, 'document.querySelector(".notes-widget textarea").value'), 'Preserved note');
  await input(page.session, '.notes-widget textarea', 'Release note saved');
  await input(page.session, '.tasks-widget .widget-add-form input', 'Release task');
  await evaluate(page.session, 'document.querySelector(".tasks-widget form").requestSubmit()');
  await poll(() => evaluate(page.session, 'document.querySelector(".tasks-widget").textContent.includes("Release task")'), 'task created');
  checked('malformed backup recovery, safe favorites, notes and tasks');
  await click(page.session, 'button[aria-label="Settings"]');
  await clickText(page.session, '.settings-sidebar nav button', 'Appearance');
  await clickText(page.session, '.settings-segment-grid button', 'Light');
  assert.equal(await evaluate(page.session, 'document.querySelector("main").classList.contains("theme-light")'), true);
  await clickText(page.session, '.settings-segment-grid button', 'Dark');
  await clickText(page.session, '.settings-sidebar nav button', 'Layout');
  await input(page.session, '.bookmark-group-add input', 'Release group');
  await evaluate(page.session, 'document.querySelector(".bookmark-group-add").requestSubmit()');
  await poll(() => evaluate(page.session, '[...document.querySelectorAll(".bookmark-group-row input")].some(el => el.value === "Release group")'), 'bookmark group added');
  await click(page.session, '.settings-close');
  await key(page.session, 'Escape');
  await click(page.session, '.add-tile');
  await input(page.session, '.add-modal input[placeholder="Name"]', 'Release favorite');
  await input(page.session, '.add-modal input[placeholder="https://example.com"]', 'https://example.org');
  await evaluate(page.session, 'document.querySelector(".add-modal").requestSubmit()');
  await poll(() => evaluate(page.session, '!document.querySelector(".add-modal")'), 'favorite saved');
  await evaluate(page.session, '[...document.querySelectorAll(".favorite-tile")].find(el=>el.textContent.includes("Release favorite")).dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true}))');
  await clickText(page.session, '.favorite-context-menu button', 'Edit shortcut');
  await input(page.session, '.add-modal input[placeholder="Name"]', 'Edited favorite');
  await evaluate(page.session, 'document.querySelector(".add-modal").requestSubmit()');
  await evaluate(page.session, '[...document.querySelectorAll(".favorite-tile")].find(el=>el.textContent.includes("Edited favorite")).dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true}))');
  await clickText(page.session, '.favorite-context-menu button', 'Delete shortcut');
  assert.equal(await evaluate(page.session, 'document.querySelector(".favorite-grid").textContent.includes("Edited favorite")'), false);
  checked('appearance, bookmark groups and favorite creation');
  checked('favorite editing and deletion');
  await click(page.session, '.task-check');
  assert.equal(await evaluate(page.session, 'document.querySelector(".task-item").classList.contains("completed")'), true);
  await click(page.session, '.task-check');
  await click(page.session, 'button[aria-label="Notifications"]');
  assert.equal(await evaluate(page.session, 'document.querySelector(".notification-panel").textContent.includes("Release task")'), true);
  assert.equal(await evaluate(page.session, 'document.querySelector(".notification-panel").textContent.includes("Calendar")'), false);
  await click(page.session, 'button[aria-label="Close notifications"]');
  checked('task completion and real task notifications');
  await click(page.session,'.profile-button');
  await input(page.session,'.profile-modal input[placeholder="Alex"]','Profile Editor Test');
  await imageUpload(page.session,'.profile-modal input[type=file]');
  await poll(()=>evaluate(page.session,'Boolean(document.querySelector(".profile-avatar-preview img"))'),'avatar preview');
  await select(page.session,'.profile-modal select','fr-FR');
  await evaluate(page.session,'document.querySelector(".profile-modal").requestSubmit()');
  await poll(()=>evaluate(page.session,'document.documentElement.lang === "fr-FR" && document.querySelector(".greeting").textContent.includes("Profile Editor Test")'),'profile language applied');
  await click(page.session,'.profile-button');
  await select(page.session,'.profile-modal select','en-US');
  await input(page.session,'.profile-modal input[placeholder="Alex"]','Pika Tester');
  await evaluate(page.session,'document.querySelector(".profile-modal").requestSubmit()');
  await poll(()=>evaluate(page.session,'document.documentElement.lang === "en-US"'),'English restored');
  checked('profile name, avatar upload and profile language apply to the interface');
  await click(page.session,'button[aria-label="Settings"]');
  await clickText(page.session,'.settings-sidebar nav button','Wallpaper');
  await imageUpload(page.session,'.settings-content input[type=file]');
  await poll(()=>evaluate(page.session,'document.querySelector("main").classList.contains("wallpaper-custom")'),'custom wallpaper selected');
  await clickText(page.session,'.wallpaper-grid button','Aurora');
  await poll(()=>evaluate(page.session,'getComputedStyle(document.querySelector(".custom-wallpaper-layer")).opacity === "0"'),'preset hides custom wallpaper');
  await clickText(page.session,'.settings-sidebar nav button','Language');
  await evaluate(page.session,'[...document.querySelectorAll(".language-list button")].find(el=>el.querySelector("span").textContent === "JA").click()');
  await poll(()=>evaluate(page.session,'document.documentElement.lang === "ja-JP"'),'settings Japanese');
  await evaluate(page.session,'document.querySelector(".language-list button").click()');
  await poll(()=>evaluate(page.session,'document.documentElement.lang === "en-US"'),'settings English');
  await click(page.session,'.settings-close');
  checked('custom wallpaper upload, preset restoration and settings language');
  for (let index=0;index<7;index++) {
    await input(page.session,'.tasks-widget .widget-add-form input',`Extra task ${index}`);
    await evaluate(page.session,'document.querySelector(".tasks-widget form").requestSubmit()');
  }
  assert.equal(await evaluate(page.session,'document.querySelectorAll(".task-item").length'),8);
  await click(page.session,'.task-item:last-child .task-check');
  assert.equal(await evaluate(page.session,'document.querySelector(".task-item:last-child").classList.contains("completed")'),true);
  await click(page.session,'.task-item:last-child .task-check');
  checked('tasks beyond the sixth entry remain visible and actionable');
  for (const [label,destination] of [['Translate','https://translate.google.com/'],['Downloads','chrome://downloads/'],['History','chrome://history/'],['New Tab','chrome://newtab/']]) {
    const before = new Set((await send('Target.getTargets')).targetInfos.map(item=>item.targetId));
    await clickText(page.session,'.quick-actions button',label);
    const created = await poll(async()=> (await send('Target.getTargets')).targetInfos.find(item=>item.type==='page' && !before.has(item.targetId)), label+' destination');
    if (label === 'New Tab') {
      const {sessionId} = await send('Target.attachToTarget',{targetId:created.targetId,flatten:true});
      await poll(()=>evaluate(sessionId,'Boolean(document.querySelector(".pikanav-page"))'),'new-tab override');
    } else assert.ok(created.url.replace(/^edge:/,'chrome:').startsWith(destination), JSON.stringify(created));
    await send('Target.closeTarget',{targetId:created.targetId});
  }
  checked('Translate, Downloads, History and actual new-tab override');
  await clickText(page.session, '.quick-actions button', 'Focus');
  assert.equal(await evaluate(page.session, 'document.querySelectorAll(".widget-column").length'), 0);
  await clickText(page.session, '.quick-actions button', 'Focus on');
  checked('focus mode opens and restores widgets');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false},page.session);
  await click(page.session,'button[aria-label="Settings"]');
  await clickText(page.session,'.settings-sidebar nav button','Layout');
  await clickText(page.session,'.settings-action','Edit dashboard layout');
  const originalOrder=await evaluate(page.session,'localStorage.getItem("pikanav.widgetOrder")');
  const beforeDrag = await evaluate(page.session,'document.querySelector(".widget-draggable").getAttribute("aria-label")');
  assert.ok(await evaluate(page.session,'document.querySelector(".notes-widget textarea").closest(".widget-content").inert'));
  assert.ok(await evaluate(page.session,'document.querySelector(".main-column").inert'));
  const dragPoints=await evaluate(page.session,'[...document.querySelectorAll(".widget-edit-controls strong")].slice(0,2).map(el=>{const r=el.getBoundingClientRect();return {x:r.x+20,y:r.y+r.height/2};})');
  await send('Input.setInterceptDrags',{enabled:true},page.session);
  const eventStart=events.length;
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',...dragPoints[0]},page.session);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...dragPoints[0],button:'left',buttons:1,clickCount:1},page.session);
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:dragPoints[0].x+16,y:dragPoints[0].y+16,button:'left',buttons:1},page.session);
  const intercepted=await poll(()=>events.slice(eventStart).find(event=>event.method==='Input.dragIntercepted'),'native HTML drag');
  for(const type of ['dragEnter','dragOver','drop']) await send('Input.dispatchDragEvent',{type,...dragPoints[1],data:intercepted.params.data},page.session);
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',...dragPoints[1],button:'left',buttons:0,clickCount:1},page.session);
  await send('Input.setInterceptDrags',{enabled:false},page.session);
  assert.notEqual(await evaluate(page.session,'document.querySelector(".widget-draggable").getAttribute("aria-label")'),beforeDrag);
  checked('trusted Chrome mouse drag-and-drop reorders widgets');
  const layoutShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},page.session);
  await writeFile(path.join(work,'layout-editor.png'),Buffer.from(layoutShot.data,'base64'));
  await evaluate(page.session, 'document.querySelector(".widget-draggable").focus()');
  const firstBefore = await evaluate(page.session, 'document.querySelector(".widget-draggable").getAttribute("aria-label")');
  await key(page.session, 'ArrowDown', { modifiers:1 });
  assert.notEqual(await evaluate(page.session, 'document.querySelector(".widget-draggable").getAttribute("aria-label")'), firstBefore);
  checked('keyboard widget reordering');
  assert.equal(await evaluate(page.session,'localStorage.getItem("pikanav.widgetOrder")'), originalOrder,'draft reorder must not persist');
  await clickText(page.session,'.layout-editor button','Cancel layout');
  assert.equal(await evaluate(page.session,'localStorage.getItem("pikanav.widgetOrder")'), originalOrder);
  await click(page.session,'button[aria-label="Settings"]');
  await clickText(page.session,'.settings-sidebar nav button','Layout');
  await clickText(page.session,'.settings-action','Edit dashboard layout');
  await clickText(page.session,'.layout-editor button','Reset layout');
  assert.equal(await evaluate(page.session,'document.querySelectorAll(".widget-draggable").length'),3);
  await clickText(page.session,'.layout-editor button','Cancel layout');
  assert.ok(await evaluate(page.session,'Boolean(document.querySelector(".notes-widget"))'),'cancel reset retains saved widgets');
  await click(page.session,'button[aria-label="Settings"]');
  await clickText(page.session,'.settings-sidebar nav button','Layout');
  await clickText(page.session,'.settings-action','Edit dashboard layout');
  await clickText(page.session,'.layout-editor button','Reset layout');
  await clickText(page.session,'.layout-editor button','Save layout');
  await poll(()=>evaluate(page.session,'(async()=>{const data=(await chrome.storage.local.get("pikanav:data"))["pikanav:data"]; return data.settings.widgets.clock && data.settings.widgets.music && data.settings.widgets.system && !data.settings.widgets.notes;})()'),'default layout saved');
  assert.equal(await evaluate(page.session,'(async()=> (await chrome.storage.local.get("pikanav.widgetData"))["pikanav.widgetData"].notes)()'),'Release note saved');
  await click(page.session,'button[aria-label="Settings"]');
  await clickText(page.session,'.settings-sidebar nav button','Widgets');
  await click(page.session,'.widget-row [aria-label="Quick Notes"]');
  await click(page.session,'.widget-row [aria-label="Task List"]');
  await click(page.session,'.settings-close');
  await click(page.session,'button[aria-label="Settings"]');
  await clickText(page.session,'.settings-sidebar nav button','Layout');
  await clickText(page.session,'.settings-action','Edit dashboard layout');
  await click(page.session,'.widget-edit-controls button[aria-label$="down"]');
  const draftOrder=await evaluate(page.session,'[...document.querySelectorAll(".widget-draggable")].map(el=>el.dataset.widgetId)');
  await click(page.session,'.widget-edit-controls button[aria-label="Hide Music Player"]');
  assert.equal(await evaluate(page.session,'Boolean(document.querySelector(".music-card"))'),false);
  await click(page.session,'.layout-options input[type=checkbox]');
  await clickText(page.session,'.layout-editor button','Save layout');
  assert.equal(await evaluate(page.session,'Boolean(document.querySelector(".layout-editor"))'),false);
  const savedOrder=await evaluate(page.session,'JSON.parse(localStorage.getItem("pikanav.widgetOrder"))');
  assert.deepEqual(savedOrder.filter(id=>draftOrder.includes(id)),draftOrder);
  await send('Page.reload',{},page.session);
  await poll(()=>evaluate(page.session,'Boolean(document.querySelector(".notes-widget"))'),'layout reload');
  assert.equal(await evaluate(page.session,'Boolean(document.querySelector(".music-card"))'),false,'widget visibility persists');
  assert.equal(await evaluate(page.session,'document.querySelector(".notes-widget textarea").value'),'Release note saved');
  assert.deepEqual(await evaluate(page.session,'JSON.parse(localStorage.getItem("pikanav.widgetOrder"))'),savedOrder);
  checked('layout drafts block widget actions; cancel/reset/save preserve content and restore after reload');
  await click(page.session, 'button[aria-label="Settings"]');
  await evaluate(page.session, 'document.querySelector(".settings-shell button").focus()');
  await key(page.session, 'Tab', { modifiers:8 });
  assert.equal(await evaluate(page.session, 'document.querySelector(".settings-shell").contains(document.activeElement)'), true);
  await key(page.session, 'Escape');
  assert.equal(await evaluate(page.session, 'Boolean(document.querySelector(".settings-shell"))'), false);
  checked('settings keyboard focus containment and Escape');
  const queriesBefore = network.filter(url=>url.includes('suggestqueries.google.com')).length;
  await input(page.session,'.search-bar input','https://private.example/path?token=test');
  await new Promise(resolve=>setTimeout(resolve,400));
  assert.equal(network.filter(url=>url.includes('suggestqueries.google.com')).length,queriesBefore);
  checked('recognized website addresses are not sent for autocomplete');
  await input(page.session, '.search-bar input', 'release');
  await poll(() => evaluate(page.session, 'document.querySelectorAll(".suggestions-menu [role=option]").length === 2'), 'suggestions fixture');
  await evaluate(page.session, 'document.querySelector(".search-bar input").focus()');
  await key(page.session, 'ArrowDown');
  await key(page.session, 'Enter', { windowsVirtualKeyCode:13 });
  await poll(() => evaluate(page.session, 'location.href.includes("release%20second") || location.href.includes("release+second")'), 'selected keyboard suggestion navigation');
  await send('Page.navigate', { url:`chrome-extension://${original.id}/index.html` }, page.session);
  await poll(() => evaluate(page.session, 'document.querySelector(".notes-widget textarea")?.value === "Release note saved"'), 'saved note after refresh');
  checked('selected keyboard suggestions and page-refresh persistence');
  await click(page.session,'button[aria-label="Image search"]');
  await imageUpload(page.session,'.image-upload-popover input[type=file]','release-photo.png');
  await poll(()=>evaluate(page.session,'new URL(location.href).searchParams.get("q") === "release photo"'),'image filename search');
  await send('Page.navigate',{url:`chrome-extension://${original.id}/index.html`},page.session);
  await poll(()=>evaluate(page.session,'Boolean(document.querySelector(".pikanav-page"))'),'dashboard after image search');
  checked('image filename search navigates without uploading image content');
  await click(page.session, 'button[aria-label="Settings"]');
  await clickText(page.session, '.settings-sidebar nav button', 'Data & Backup');
  await importBackup(page.session, { settings: { widgets:{weather:true,news:true,notes:true,tasks:true,music:true,clock:true,system:false},visibility:{topBarStats:false} }, weatherLocation:{name:'Test city',country:'Test',latitude:1.35,longitude:103.82,timezone:'Asia/Singapore',source:'manual'} });
  await click(page.session,'.settings-close');
  await poll(()=>evaluate(page.session,'document.querySelector(".weather-card").textContent.includes("27°C")'),'weather fixture');
  await poll(()=>evaluate(page.session,'document.querySelector(".news-widget").textContent.includes("Test headline")'),'news fixture');
  checked('weather and news ready states using deterministic service fixtures');
  offline = true;
  await clickText(page.session,'.news-topics button','world');
  await clickText(page.session,'.weather-location-footer button','Change location');
  await input(page.session,'.weather-location-picker input','Singapore');
  await poll(()=>evaluate(page.session,'document.querySelector(".weather-location-results").textContent.includes("unavailable")'),'offline geocoder');
  await evaluate(page.session,'window.dispatchEvent(new Event("pikanav:refresh-weather"))');
  await poll(()=>evaluate(page.session,'[...document.querySelectorAll(".weather-card button")].some(el=>el.textContent==="Retry weather")'),'offline weather state');
  await poll(()=>evaluate(page.session,'[...document.querySelectorAll(".news-widget button")].some(el=>el.textContent==="Retry headlines")'),'offline news state');
  offline = false;
  await clickText(page.session,'.weather-card button','Retry weather');
  await clickText(page.session,'.news-widget button','Retry headlines');
  await poll(()=>evaluate(page.session,'document.querySelector(".weather-card").textContent.includes("27°C")'),'weather recovered');
  await poll(()=>evaluate(page.session,'document.querySelector(".news-widget").textContent.includes("Test headline")'),'news recovered');
  await input(page.session,'.weather-location-picker input','Singapore city');
  await poll(()=>evaluate(page.session,'Boolean(document.querySelector(".weather-location-results button:not(.weather-location-current)"))'),'geocoder results');
  await click(page.session,'.weather-location-results button:not(.weather-location-current)');
  await poll(()=>evaluate(page.session,'document.querySelector(".weather-location-footer").textContent.includes("Singapore")'),'location applied');
  checked('offline weather, news and city search recover through retry');
  await send('ServiceWorker.enable', {}, page.session);
  await send('ServiceWorker.stopAllWorkers', {}, page.session);
  const restarted = await evaluate(page.session, 'chrome.runtime.sendMessage({type:"mediaCommand",command:"getCurrentMedia"})');
  assert.equal(restarted.ok, true);
  checked('service worker stopped and restarted by a message');
  const second = await open(`chrome-extension://${original.id}/index.html`);
  await poll(() => evaluate(second.session, 'document.querySelector(".notes-widget textarea")?.value === "Release note saved"'), 'second tab local state');
  await input(page.session, '.notes-widget textarea', 'Shared across tabs');
  await poll(() => evaluate(second.session, 'document.querySelector(".notes-widget textarea")?.value === "Shared across tabs"'), 'cross-tab note update');
  await send('Target.closeTarget', {targetId:second.targetId});
  checked('multiple tabs share widget changes');
  await click(page.session, 'button[aria-label="Settings"]');
  await clickText(page.session,'.accent-grid button','Custom');
  await input(page.session,'input[aria-label="accent HEX"]','#3399ff');
  await clickText(page.session,'.custom-color-editor button','Save colors');
  await clickText(page.session, '.settings-sidebar nav button', 'Data & Backup');
  await send('Browser.setDownloadBehavior', { behavior:'allow', downloadPath:downloads });
  await clickText(page.session, '.data-actions button', 'Export settings');
  const exported = await poll(async () => { try { return JSON.parse(await readFile(path.join(downloads,'pikaspace-settings.json'),'utf8')); } catch { return false; } }, 'settings export download');
  await writeFile(path.join(work,'exported-backup.json'),JSON.stringify(exported,null,2));
  assert.equal(exported.widgetData.notes, 'Shared across tabs');
  assert.equal(exported.widgetData.events[0].id, 'sample-event');
  assert.equal(exported.profile.displayName, 'Pika Tester');
  assert.match(exported.profile.avatarDataUrl,/^data:image\/png;base64,/);
  assert.match(exported.customWallpaperDataUrl,/^data:image\/png;base64,/);
  assert.ok(exported.widgetOrder.length);
  assert.equal(exported.settings.customColors.accent,'#3399ff');
  await importBackup(page.session, {...exported,widgetData:{...exported.widgetData,notes:'Round-trip note'}});
  await click(page.session, '.settings-close');
  await poll(() => evaluate(page.session, 'document.querySelector(".notes-widget textarea").value === "Round-trip note"'), 'backup import');
  checked('PikaSpace settings export and import including widget data and profile');
  await click(page.session,'button[aria-label="Settings"]');
  await clickText(page.session,'.settings-sidebar nav button','Data & Backup');
  await click(page.session,'.reset-button');
  await clickText(page.session,'.reset-confirm button','Reset preferences and favorites');
  await poll(()=>evaluate(page.session,'(async()=>{const value=(await chrome.storage.local.get("pikanav:data"))["pikanav:data"];return value?.favorites?.some(item=>item.label==="GitHub");})()'),'preferences reset');
  assert.equal(await evaluate(page.session,'(async()=>{const data=(await chrome.storage.local.get("pikanav.widgetData"))["pikanav.widgetData"];return data.notes==="Round-trip note" && data.events[0].id==="sample-event";})()'),true);
  await click(page.session,'button[aria-label="Settings"]');
  await clickText(page.session,'.settings-sidebar nav button','Data & Backup');
  await importBackup(page.session,{...exported,widgetData:{...exported.widgetData,notes:'Round-trip note'}});
  await click(page.session,'.settings-close');
  await poll(()=>evaluate(page.session,'document.querySelector(".notes-widget textarea")?.value === "Round-trip note"'),'backup restored after reset');
  checked('confirmed preferences reset retains notes, tasks and dormant events; backup restores preferences');
  for (const [width,height] of [[1440,1000],[800,600],[720,500],[390,844],[320,640]]) {
    await send('Emulation.setDeviceMetricsOverride', {width,height,deviceScaleFactor:width===720?2:1,mobile:false}, page.session);
    await new Promise(resolve => setTimeout(resolve,100));
    assert.equal(await evaluate(page.session, 'document.documentElement.scrollWidth <= innerWidth'), true);
    await click(page.session, 'button[aria-label="Settings"]');
    const bounds = await evaluate(page.session, '(() => { const el=document.querySelector(".settings-shell"); const r=el.getBoundingClientRect(); return {left:r.left,right:r.right,bottom:r.bottom,top:r.top,overflow:el.scrollWidth>el.clientWidth}; })()');
    assert.ok(bounds.left >= 0 && bounds.right <= width && bounds.top >= 0 && bounds.bottom <= height && !bounds.overflow, JSON.stringify({width,bounds}));
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},page.session);
    await writeFile(path.join(work,`settings-${width}.png`),Buffer.from(shot.data,'base64'));
    for(const tab of ['Wallpaper','Layout','Widgets','Language','Data & Backup','About PikaSpace']) {
      await clickText(page.session,'.settings-sidebar nav button',tab);
      assert.ok(await evaluate(page.session,'(() => {const el=document.querySelector(".settings-content");return el.scrollWidth <= el.clientWidth;})()'), `${tab} overflow at ${width}`);
      if(tab==='Widgets') {
        assert.ok(await evaluate(page.session,'[...document.querySelectorAll(".widget-row .settings-toggle")].every(el=>{const a=el.getBoundingClientRect(), b=el.firstElementChild.getBoundingClientRect();return b.top>=a.top && b.bottom<=a.bottom && b.left>=a.left && b.right<=a.right;})'),'switch thumbs stay inside tracks');
      }
      if(tab==='About PikaSpace') {
        const aboutShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},page.session);
        await writeFile(path.join(work,`about-${width}.png`),Buffer.from(aboutShot.data,'base64'));
      }
    }
    await click(page.session,'.settings-close');
  }
  await send('Emulation.setDeviceMetricsOverride', {width:1440,height:1000,deviceScaleFactor:1,mobile:false},page.session);
  checked('dashboard and settings bounds at five screen sizes including a 200-percent-equivalent viewport');
  await click(page.session,'button[aria-label="Settings"]');
  await clickText(page.session,'.settings-sidebar nav button','Widgets');
  await click(page.session,'.widget-row [aria-label="Weather"]');
  await click(page.session,'.widget-row [aria-label="News Feed"]');
  await click(page.session,'.settings-close');
  await poll(()=>evaluate(page.session,'!document.querySelector(".weather-card") && !document.querySelector(".news-widget")'),'disabled widget removal');
  await new Promise(resolve=>setTimeout(resolve,100));
  const disabledBefore = network.filter(url=>/open-meteo|news.google.com/.test(url)).length;
  await evaluate(page.session,'window.dispatchEvent(new Event("pikanav:refresh-weather"))');
  await new Promise(resolve=>setTimeout(resolve,300));
  assert.equal(network.filter(url=>/open-meteo|news.google.com/.test(url)).length,disabledBefore);
  checked('disabled weather and news perform no refresh requests');
  assert.ok(!network.some(url => /googleapis|calendar/.test(url)));
  checked('no Calendar network traffic');
  // Restart the complete disposable browser, preserving its profile and extension path.
  await send('Browser.close');
  if (child.exitCode === null) await once(child,'exit');
  ws.close();
  await rm(path.join(profile,'DevToolsActivePort'),{force:true});
  child = launchChrome();
  const restartedPort = await poll(async()=> { try { return await readFile(path.join(profile,'DevToolsActivePort'),'utf8'); } catch { return false; } },'restarted Chrome endpoint');
  const [newPort,newEndpoint]=restartedPort.trim().split(/\r?\n/);
  ws = new WebSocket(`ws://127.0.0.1:${newPort}${newEndpoint}`);
  await once(ws,'open'); ws.addEventListener('message',receive);
  const restored = await send('Extensions.loadUnpacked',{path:extension});
  assert.equal(restored.id,original.id);
  page = await open(`chrome-extension://${restored.id}/index.html`);
  await poll(()=>evaluate(page.session,'document.querySelector(".notes-widget textarea")?.value === "Round-trip note"'),'complete browser restart persistence');
  assert.equal(await evaluate(page.session,'document.querySelector(".greeting").textContent.includes("Pika Tester")'),true);
  assert.equal(await evaluate(page.session,'document.querySelector("main").style.getPropertyValue("--accent")'),'#3399ff');
  assert.deepEqual(await evaluate(page.session,'JSON.parse(localStorage.getItem("pikanav.widgetOrder"))'),exported.widgetOrder);
  checked('full browser restart preserves notes, profile and preferences');
  await writeFile(path.join(work,'dashboard-checks.json'),JSON.stringify({chrome:(await send('Browser.getVersion')).product,checks,externalServices:'deterministic fixtures; live availability not certified'},null,2));

  await send('Target.closeTarget', { targetId: page.targetId });
  await send('Extensions.uninstall', { id: original.id });

  const granted = await send('Extensions.loadUnpacked', { path: clone });
  const emptyDashboard = await open(`chrome-extension://${granted.id}/index.html`);
  const noCompanion = await evaluate(emptyDashboard.session, 'chrome.runtime.sendMessage({type:"mediaCommand",command:"getCurrentMedia"})');
  assert.equal(noCompanion.ok, true);
  assert.equal(noCompanion.hasSession, false);
  assert.equal(noCompanion.requiresBrowserAccess, false);
  await send('Target.closeTarget', { targetId: emptyDashboard.targetId });
  const mediaPage = await open(`http://127.0.0.1:${port}/media`);
  await evaluate(mediaPage.session, 'document.querySelector("audio").play().then(() => true)', true);
  const dashboard = await open(`chrome-extension://${granted.id}/index.html`);
  await poll(() => evaluate(dashboard.session, 'document.querySelector(".music-card")?.textContent.includes("Portable media test")'), 'browser track metadata');
  const current = await evaluate(dashboard.session, 'chrome.runtime.sendMessage({type:"mediaCommand",command:"getCurrentMedia"})');
  assert.equal(current.backend, 'browser');
  assert.equal(current.title, 'Portable media test');
  assert.equal(current.artist, 'PikaSpace fixture');
  assert.equal(current.playbackStatus, 'Playing');
  assert.equal(current.capabilities.next, false);
  assert.ok(current.target.documentId);
  assert.equal(await evaluate(dashboard.session, 'chrome.runtime.getManifest().permissions.includes("nativeMessaging")'), false);
  await evaluate(dashboard.session, 'document.querySelector(".music-card .play-control").click()');
  await poll(() => evaluate(mediaPage.session, 'document.querySelector("audio").paused'), 'pause from dashboard button');
  await poll(() => evaluate(dashboard.session, 'document.querySelector(".music-card .play-control").getAttribute("aria-label") === "Play"'), 'paused widget');
  await evaluate(dashboard.session, 'document.querySelector(".music-card .play-control").click()');
  await poll(async () => !await evaluate(mediaPage.session, 'document.querySelector("audio").paused'), 'resume from dashboard button');
  await poll(() => evaluate(dashboard.session, 'document.querySelector(".music-card .play-control").getAttribute("aria-label") === "Pause"'), 'playing widget');
  assert.equal(await evaluate(dashboard.session, '[...document.querySelectorAll(".music-card button")].find(button => button.getAttribute("aria-label") === "Next track").disabled'), true);
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, dashboard.session);
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, dashboard.session);
  await writeFile(path.join(work, 'dashboard-browser-media.png'), Buffer.from(screenshot.data, 'base64'));
  await send('Target.closeTarget', { targetId: mediaPage.targetId });
  const closed = await evaluate(dashboard.session, `chrome.runtime.sendMessage(${JSON.stringify({ type: 'mediaCommand', command: 'playPause', backend: 'browser', target: current.target })})`);
  assert.equal(closed.ok, false);
  const noPlayer = await evaluate(dashboard.session, 'chrome.runtime.sendMessage({type:"mediaCommand",command:"getCurrentMedia"})');
  assert.equal(noPlayer.ok, true);
  assert.equal(noPlayer.hasSession, false);
  const runtimeErrors = events.filter(event => event.method === 'Runtime.exceptionThrown');
  await Promise.allSettled(diagnosticReads);
  await writeFile(path.join(work,'runtime-diagnostics.json'),JSON.stringify(runtimeDiagnostics,null,2));
  assert.equal(runtimeErrors.length, 0, JSON.stringify(runtimeErrors));
  const result = { chrome: (await send('Browser.getVersion')).product, portableManifest: 'passed', noCompanion: 'passed', actualFrameInjection: 'passed', metadata: 'passed', dashboardPlayPause: 'passed', unsupportedControlsDisabled: 'passed', closedTab: 'passed', noPlayer: 'passed', runtimeErrors: runtimeErrors.length };
  await writeFile(path.join(work, 'results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (ws?.readyState === WebSocket.OPEN) {
    try { await send('Browser.close'); } catch {}
    ws.close();
  }
  child.kill();
  server.close();
  for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('Browser closed')); }
  await new Promise(resolve => setTimeout(resolve, 600));
  // These exact test paths are generated under this project's .verification folder.
  for (const directory of [profile, clone]) {
    if (path.dirname(directory) !== work || !directory.startsWith(root + path.sep)) throw new Error('Unsafe test cleanup path');
    await rm(directory, { recursive: true, force: true, maxRetries: 4, retryDelay: 250 });
  }
}
