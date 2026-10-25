import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { once } from 'node:events';

const root=path.resolve('.'), work=path.join(root,'.verification','search');
await mkdir(work,{recursive:true});
const profile=await mkdtemp(path.join(work,'chrome-'));
const child=spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',[
  '--headless=new','--disable-gpu','--remote-debugging-port=0','--enable-unsafe-extension-debugging',`--user-data-dir=${profile}`,
  '--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync',
  '--use-fake-device-for-media-stream','--mute-audio','about:blank',
],{windowsHide:true,stdio:'ignore'});
let ws, sequence=0;
const pending=new Map(),events=[],errors=[],requests=[],checks=[];
function send(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`Timed out: ${method}`))},12000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
async function poll(fn,label){for(let i=0;i<90;i++){const value=await fn();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw new Error(`Timed out: ${label}`);}
async function evaluate(session,expression,userGesture=false){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture},session);if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result?.value;}
const checked=label=>{checks.push(label);console.log('PASS:',label)};
async function click(session,selector){await evaluate(session,`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing '+${JSON.stringify(selector)});el.click()})()`,true);}
async function clickText(session,selector,text){await evaluate(session,`(()=>{const el=[...document.querySelectorAll(${JSON.stringify(selector)})].find(el=>el.textContent.trim()===${JSON.stringify(text)});if(!el)throw new Error('Missing '+${JSON.stringify(text)});el.click()})()`,true);}
async function input(session,selector,value){await evaluate(session,`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}))})()`);}
async function key(session,key){const codes={Enter:13,Escape:27,Tab:9};await send('Input.dispatchKeyEvent',{type:'keyDown',key,code:key,...(codes[key]?{windowsVirtualKeyCode:codes[key]}:{}),...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{})},session);await send('Input.dispatchKeyEvent',{type:'keyUp',key,code:key,...(codes[key]?{windowsVirtualKeyCode:codes[key]}:{})},session);}
async function chooseImage(session,type='image/png',name='private-file.png',invalid=false){await evaluate(session,`(()=>{const canvas=document.createElement('canvas');canvas.width=32;canvas.height=24;canvas.getContext('2d').fillRect(0,0,32,24);const raw=atob(canvas.toDataURL(${JSON.stringify(type)}).split(',')[1]);const file=new File([${invalid?'"not an image"':'Uint8Array.from(raw,c=>c.charCodeAt(0))'}],${JSON.stringify(name)},{type:${JSON.stringify(type)}});const el=document.querySelector('.image-upload-popover input[type=file]');const dt=new DataTransfer();dt.items.add(file);el.files=dt.files;el.dispatchEvent(new Event('change',{bubbles:true}))})()`);}

try{
  const active=await poll(async()=>{try{return await readFile(path.join(profile,'DevToolsActivePort'),'utf8')}catch{return false}},'Chrome endpoint');
  const [port,endpoint]=active.trim().split(/\r?\n/);ws=new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);await once(ws,'open');
  ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const item=pending.get(m.id);if(!item)return;clearTimeout(item.timer);pending.delete(m.id);m.error?item.reject(new Error(JSON.stringify(m.error))):item.resolve(m.result);}else{events.push(m);if(m.method==='Runtime.exceptionThrown'||m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m);if(m.method==='Fetch.requestPaused'){requests.push(m.params.request);const url=m.params.request.url;const body=/suggestqueries|duckduckgo.*ac\/|bing.*osjson/.test(url)?'[]':'<!doctype html><title>Official destination navigation fixture</title>';void send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:body==='[]'?'application/json':'text/html'}],body:Buffer.from(body).toString('base64')},m.sessionId).catch(()=>{});}}});
  const {id}=await send('Extensions.loadUnpacked',{path:path.join(root,'dist')});
  assert.equal(id,'abipfjhfejgjkhcpilkfdhbgaepljpki');
  const origin=`chrome-extension://${id}`,url=`${origin}/index.html`;
  const {targetId}=await send('Target.createTarget',{url});const {sessionId:session}=await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Runtime.enable',{},session);await send('Page.enable',{},session);await send('Fetch.enable',{patterns:[{urlPattern:'https://*'}]},session);
  await poll(()=>evaluate(session,'Boolean(document.querySelector(".search-bar"))'),'search bar');
  const worker=(await send('Target.getTargets')).targetInfos.find(t=>t.type==='service_worker'&&t.url.startsWith(origin));
  if(worker){const {sessionId:workerSession}=await send('Target.attachToTarget',{targetId:worker.targetId,flatten:true});await send('Runtime.enable',{},workerSession);await send('Fetch.enable',{patterns:[{urlPattern:'https://*'}]},workerSession);}
  const setupMocks=async()=>evaluate(session,`(()=>{
    window.speechInstances=[];window.microphoneTracks=[];window.microphoneRequests=0;
    window.nativeSpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    const realMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=async constraints=>{microphoneRequests++;const stream=await realMedia(constraints);microphoneTracks.push(...stream.getTracks());return stream;};
    class Recognition{constructor(){speechInstances.push(this);this.aborts=0;this.stops=0;}start(){queueMicrotask(()=>this.onstart?.());}stop(){this.stops++;}abort(){this.aborts++;}}
    window.SpeechRecognition=window.webkitSpeechRecognition=Recognition;
  })()`);
  const navigateHome=async()=>{await send('Page.navigate',{url},session);await poll(()=>evaluate(session,'document.readyState === "complete" && Boolean(document.querySelector(".search-bar")) && !window.speechInstances').catch(()=>false),'dashboard');await setupMocks();};
  const provider=async label=>{await click(session,'.provider-button');await evaluate(session,`[...document.querySelectorAll('.provider-menu button')].find(el=>el.textContent.trim().endsWith(${JSON.stringify(label)})).click()`);};
  const startVoice=async()=>{await click(session,'[title="Search by voice"]');await clickText(session,'.search-tool-actions button','Start listening');};
  const speechResult=async(text,final=true)=>evaluate(session,`speechInstances.at(-1).onresult({results:[Object.assign([{transcript:${JSON.stringify(text)}}],{isFinal:${final}})]})`);
  await setupMocks();
  assert.equal(await evaluate(session,'isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia)'),true);
  assert.equal(await evaluate(session,'chrome.runtime.getManifest().permissions.includes("audioCapture")'),false);
  await input(session,'.search-bar input','keep original text');
  await click(session,'[title="Search by voice"]');
  assert.ok(await evaluate(session,'document.querySelector(".voice-search-dialog").matches(":modal")'));
  assert.equal(await evaluate(session,'microphoneRequests'),0,'opening the dialog cannot start capture');
  assert.ok(await evaluate(session,'document.querySelector("#voice-privacy").textContent.includes("may send audio")'));
  await key(session,'Escape');
  await poll(()=>evaluate(session,'!document.querySelector(".voice-search-dialog")'),'voice cancel');
  assert.equal(await evaluate(session,'document.querySelector(".search-bar input").value'),'keep original text');
  checked('microphone opens an accessible modal, discloses speech service, and never captures before consent');

  await send('Browser.setPermission',{permission:{name:'microphone'},setting:'denied',origin});
  await startVoice();
  await poll(()=>evaluate(session,'document.querySelector(".voice-status").textContent.includes("denied")'),'real microphone denial');
  assert.equal(await evaluate(session,'speechInstances.length'),0);
  await clickText(session,'.search-tool-actions button','Cancel');
  checked('actual Chrome microphone denial produces helpful feedback without starting recognition');
  await send('Browser.setPermission',{permission:{name:'microphone'},setting:'granted',origin});
  await startVoice();
  await poll(()=>evaluate(session,'document.querySelector(".voice-status").textContent.includes("Listening…")'),'listening');
  assert.ok(await evaluate(session,'microphoneTracks.length>0 && microphoneTracks.every(track=>track.readyState==="ended")'),'permission-check capture must be released');
  await speechResult('interim words',false);
  assert.equal(await evaluate(session,'document.querySelector(".search-bar input").value'),'keep original text');
  await clickText(session,'.search-tool-actions button','Stop listening');
  assert.equal(await evaluate(session,'speechInstances.at(-1).stops'),1);
  await speechResult('recognized final phrase');
  await poll(()=>evaluate(session,'document.querySelector(".search-bar input").value === "recognized final phrase"'),'recognized input');
  assert.ok(await evaluate(session,'location.protocol === "chrome-extension:"'));
  assert.equal(await evaluate(session,'speechInstances.at(-1).aborts'),1);
  await clickText(session,'.search-tool-actions button','Use text');
  await poll(()=>evaluate(session,'document.activeElement === document.querySelector(".search-bar input")'),'search input focus');
  checked('real microphone grant releases tracks; interim/final results, stop, review and use-text flows work');
  await startVoice();await poll(()=>evaluate(session,'speechInstances.at(-1)?.onresult != null'),'second speech session');
  await evaluate(session,'window.lateSpeech=speechInstances.at(-1).onresult');
  await key(session,'Escape');
  await poll(()=>evaluate(session,'!document.querySelector(".voice-search-dialog")'),'listening cancellation');
  await evaluate(session,'lateSpeech({results:[Object.assign([{transcript:"late ignored"}],{isFinal:true})]})');
  assert.equal(await evaluate(session,'document.querySelector(".search-bar input").value'),'recognized final phrase');
  checked('Escape cancels recognition and ignores late results');
  await startVoice();await poll(()=>evaluate(session,'speechInstances.at(-1)?.onresult != null'),'pagehide session');
  await evaluate(session,'window.dispatchEvent(new PageTransitionEvent("pagehide",{persisted:true}))');
  assert.equal(await evaluate(session,'speechInstances.at(-1).aborts'),1);
  await clickText(session,'.search-tool-actions button','Start listening');
  await poll(()=>evaluate(session,'speechInstances.at(-1)?.onresult != null'),'retry after cached page return');
  await clickText(session,'.search-tool-actions button','Cancel');
  checked('page exit ends capture and a cached page can start a fresh attempt');
  for(const code of ['no-speech','network','not-allowed','service-not-allowed','audio-capture','language-not-supported']){
    await startVoice();await poll(()=>evaluate(session,'speechInstances.at(-1)?.onerror != null'),'speech error handler');
    await evaluate(session,`speechInstances.at(-1).onerror({error:${JSON.stringify(code)}})`);
    assert.equal(await evaluate(session,'document.querySelector(".voice-status").classList.contains("is-listening")'),false);
    assert.equal(await evaluate(session,'speechInstances.at(-1).aborts'),1);await clickText(session,'.search-tool-actions button','Cancel');
  }
  await evaluate(session,'window.SpeechRecognition=window.webkitSpeechRecognition=undefined');
  await click(session,'[title="Search by voice"]');
  assert.ok(await evaluate(session,'document.querySelector(".voice-search-dialog").textContent.includes("not supported")'));
  assert.equal(await evaluate(session,'[...document.querySelectorAll(".search-tool-actions button")].find(el=>el.textContent==="Start listening").disabled'),true);
  await key(session,'Escape');
  checked('silence, network, permission, microphone, language and unsupported API states are handled');
  for(const [label,host] of [['Google','www.google.com'],['Bing','www.bing.com'],['DuckDuckGo','duckduckgo.com'],['Perplexity','www.perplexity.ai']]){
    await navigateHome();await provider(label);await startVoice();await poll(()=>evaluate(session,'speechInstances.at(-1)?.onresult != null'),'speech result');await speechResult(`voice ${label}`);
    await clickText(session,'.search-tool-actions button',`Search ${label}`);
    await poll(()=>evaluate(session,`location.hostname===${JSON.stringify(host)} && new URL(location.href).searchParams.get('q')===${JSON.stringify(`voice ${label}`)}`),'selected engine voice search');
  }
  checked('voice searches use each of the four selected engines');
  await navigateHome();await input(session,'.search-bar input','normal text search');await evaluate(session,'document.querySelector(".search-bar input").focus()');await key(session,'Enter');
  await poll(()=>evaluate(session,'location.hostname==="www.google.com" && new URL(location.href).searchParams.get("q")==="normal text search"'),'normal Enter search');
  checked('normal Enter search still works');
  await navigateHome();await input(session,'.search-bar input','preserve query');
  await evaluate(session,`document.querySelector('[title="Search by image"]').focus()`);await key(session,'Enter');
  await poll(()=>evaluate(session,'Boolean(document.querySelector(".image-upload-popover")?.matches(":modal"))'),'keyboard image dialog');
  await send('Page.setInterceptFileChooserDialog',{enabled:true},session);
  let eventIndex=events.length;await click(session,'.image-upload-dropzone');
  const chooser=await poll(()=>events.slice(eventIndex).find(event=>event.method==='Page.fileChooserOpened'),'native image chooser');
  const png=await evaluate(session,'(()=>{const c=document.createElement("canvas");c.width=4;c.height=4;return c.toDataURL("image/png").split(",")[1]})()');
  const filename=path.join(work,'selected-local.png');await writeFile(filename,Buffer.from(png,'base64'));
  await send('DOM.setFileInputFiles',{files:[filename],backendNodeId:chooser.params.backendNodeId},session);
  await poll(()=>evaluate(session,'document.querySelector(".image-upload-popover img")?.naturalWidth>0'),'native chosen image');
  eventIndex=events.length;await click(session,'.image-upload-dropzone');const cancelled=await poll(()=>events.slice(eventIndex).find(event=>event.method==='Page.fileChooserOpened'),'cancelled chooser');
  await send('DOM.setFileInputFiles',{files:[],backendNodeId:cancelled.params.backendNodeId},session);
  assert.equal(await evaluate(session,'document.querySelector(".image-upload-popover img").alt'),'Selected image: selected-local.png');
  await send('Page.setInterceptFileChooserDialog',{enabled:false},session);
  for(const type of ['image/png','image/jpeg','image/webp']){await chooseImage(session,type,`private-${type.split('/')[1]}.${type==='image/jpeg'?'jpg':type.split('/')[1]}`);await poll(()=>evaluate(session,'document.querySelector(".image-upload-popover img")?.naturalWidth===32 && !document.querySelector(".search-tool-actions button.primary")'),'decoded image');}
  assert.equal(await evaluate(session,'document.querySelector(".search-bar input").value'),'preserve query');
  assert.ok(await evaluate(session,'location.protocol==="chrome-extension:"'));
  checked('keyboard image button, real file chooser, chooser cancellation and PNG/JPG/WebP previews work without navigation');
  await chooseImage(session,'image/png','broken.png',true);
  await poll(()=>evaluate(session,'document.querySelector(".image-upload-error")?.textContent.includes("could not be read")'),'corrupt image error');
  assert.equal(await evaluate(session,'document.querySelector(".search-tool-actions button.primary").disabled'),true);
  await chooseImage(session,'image/svg+xml','unsafe.svg');assert.ok(await evaluate(session,'document.querySelector(".image-upload-error").textContent.includes("PNG, JPG, or WebP")'));
  await chooseImage(session);await poll(()=>evaluate(session,'document.querySelector(".image-upload-popover img")?.naturalWidth===32'),'replacement preview');
  for(const [button,expected] of [['Google Images / Lens','https://images.google.com/'],['Bing Visual Search','https://www.bing.com/images']]){
    await clickText(session,'.image-provider-options button',button);
    const anchor=await evaluate(session,'(()=>{const a=document.querySelector(".search-tool-actions a");return {href:a.href,target:a.target,rel:a.rel}})()');
    assert.equal(anchor.href,expected);assert.equal(anchor.target,'_blank');assert.ok(anchor.rel.includes('noopener'));
    const before=new Set((await send('Target.getTargets')).targetInfos.map(t=>t.targetId));await click(session,'.search-tool-actions a');
    const external=await poll(async()=> (await send('Target.getTargets')).targetInfos.find(t=>!before.has(t.targetId)&&t.type==='page'&&t.url.startsWith(expected)),'official provider handoff');
    await send('Target.closeTarget',{targetId:external.targetId});await send('Page.bringToFront',{},session);
    assert.equal(await evaluate(session,'document.querySelector(".search-bar input").value'),'preserve query');
  }
  await clickText(session,'.search-tool-actions button','Cancel');
  checked('invalid images are rejected; safe new-tab Google/Bing handoffs preserve input and preview');
  for(const label of ['DuckDuckGo','Perplexity']){await provider(label);await click(session,'[title="Search by image"]');assert.ok(await evaluate(session,'document.querySelector(".image-upload-popover").textContent.includes("not connected")'));assert.equal(await evaluate(session,'Boolean(document.querySelector(".search-tool-actions a"))'),false);await clickText(session,'.image-provider-options button','Google Images / Lens');assert.ok(await evaluate(session,`document.querySelector('.provider-button').textContent.includes(${JSON.stringify(label)})`));await key(session,'Escape');}
  checked('unsupported image providers explain the limitation and require an explicit alternative');
  await clickText(session,'.quick-actions button','Focus');
  for(const [width,height] of [[1440,900],[800,600],[390,844],[320,640]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false},session);
    assert.ok(await evaluate(session,'[...document.querySelectorAll(".search-bar .tool-button")].every(el=>{const r=el.getBoundingClientRect();return r.width>=30 && r.height>=30;})'),'both search tools stay visible');
    for(const kind of ['image','voice']){await click(session,`[title="Search by ${kind}"]`);if(kind==='image'){await clickText(session,'.image-provider-options button','Google Images / Lens');await chooseImage(session);await poll(()=>evaluate(session,'document.querySelector(".image-upload-popover img")?.naturalWidth===32'),'responsive preview');}assert.ok(await evaluate(session,'(()=>{const d=document.querySelector(".search-tool-dialog"),r=d.getBoundingClientRect();return d.matches(":modal")&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&d.scrollWidth<=d.clientWidth})()'),`${kind} bounds at ${width}`);const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},session);await writeFile(path.join(work,`${kind}-${width}.png`),Buffer.from(shot.data,'base64'));await key(session,'Escape');}
  }
  assert.equal(errors.length,0,JSON.stringify(errors));
  assert.ok(requests.every(request=>request.method==='GET'),'no image/audio uploads are issued by page or worker');
  assert.ok(!requests.some(request=>/private-file|selected-local|broken\.png/.test(request.url)),'selected filenames never leave the page');
  checked('top-layer dialogs remain visible in focus mode across four viewport sizes; zero runtime errors or image uploads');
  const report={chrome:(await send('Browser.getVersion')).product,checks,runtimeErrors:errors.length,microphone:'real Chrome permissions with a synthetic device; tracks released',speech:'controlled recognition events; live cloud transcription is not certified',imageSearch:'official-page handoffs only; uploads remain on the provider page',extensionId:id};
  await writeFile(path.join(work,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{
  if(ws?.readyState===WebSocket.OPEN){try{await send('Browser.close')}catch{}ws.close();}
  if(child.exitCode===null)child.kill();for(const item of pending.values())clearTimeout(item.timer);
  await new Promise(resolve=>setTimeout(resolve,500));
  if(path.dirname(profile)!==work||!profile.startsWith(root+path.sep))throw new Error('Unsafe profile cleanup');
  await rm(profile,{recursive:true,force:true,maxRetries:4,retryDelay:250});
}
