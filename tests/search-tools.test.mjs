import assert from 'node:assert/strict';
import test from 'node:test';
import { createVoiceController, voiceErrorMessage, validateSearchImage, IMAGE_SEARCH_PROVIDERS } from '../src/app/search-tools.mjs';

function fixture(options = {}) {
  const states=[], texts=[], instances=[], timers=new Map();
  let stoppedTracks=0, requested=0;
  class Recognition {
    constructor() { instances.push(this); }
    start() { this.starts=(this.starts||0)+1; this.onstart?.(); }
    stop() { this.stops=(this.stops||0)+1; }
    abort() { this.aborts=(this.aborts||0)+1; }
  }
  const controller=createVoiceController({ Recognition, getUserMedia:async constraints=>{ assert.deepEqual(constraints,{audio:true});requested++;return {getTracks:()=>[{stop:()=>stoppedTracks++}]}; },
    onState:value=>states.push(value),onText:value=>texts.push(value),setTimer:fn=>{const key={};timers.set(key,fn);return key;},clearTimer:key=>timers.delete(key),...options });
  return {controller,states,texts,instances,timers,get requested(){return requested},get stoppedTracks(){return stoppedTracks}};
}
const result = (text, isFinal) => Object.assign([{transcript:text}],{isFinal});

test('voice never requests permission or starts capture until explicitly started', async()=>{
  const f=fixture(); assert.equal(f.requested,0);assert.equal(f.instances.length,0);
  await f.controller.start('zh-CN');
  assert.equal(f.stoppedTracks,1);assert.equal(f.instances[0].lang,'zh-CN');
  assert.equal(f.instances[0].continuous,false);assert.equal(f.states.at(-1).phase,'listening');
  f.controller.dispose();assert.equal(f.timers.size,0);
});
test('interim speech previews; final speech fills text without submitting and releases capture', async()=>{
  const f=fixture();await f.controller.start('en-US');const current=f.instances[0];
  current.onresult({results:[result('hello',false)]});assert.deepEqual(f.texts,[]);assert.equal(f.states.at(-1).transcript,'hello');
  current.onresult({results:[result('hello world',true)]});assert.deepEqual(f.texts,['hello world']);assert.equal(current.aborts,1);assert.equal(f.timers.size,0);
  assert.equal(f.states.at(-1).phase,'complete');assert.equal(current.onresult,null);
});
test('stop flushes the active recognizer, then accepts its final result', async()=>{
  const f=fixture();await f.controller.start('en-US');const current=f.instances[0];f.controller.stop();
  assert.equal(current.stops,1);assert.equal(f.states.at(-1).phase,'stopping');
  current.onresult({results:[result('partial while stopping',false)]});
  f.controller.stop();assert.equal(current.stops,1);assert.equal(f.states.at(-1).phase,'stopping');
  current.onresult({results:[result('stopped phrase',true)]});assert.equal(f.texts[0],'stopped phrase');assert.equal(current.aborts,1);
});
test('cancel and disposal ignore late speech callbacks and clear timeouts', async()=>{
  for(const action of ['cancel','dispose']){
    const f=fixture();await f.controller.start('en-US');const current=f.instances[0],late=current.onresult;
    f.controller[action]();late({results:[result('must not arrive',true)]});assert.deepEqual(f.texts,[]);assert.equal(current.aborts,1);assert.equal(f.timers.size,0);
  }
});
test('a late microphone grant after cancellation stops tracks and never starts recognition', async()=>{
  let grant, stopped=0;
  const f=fixture({getUserMedia:()=>new Promise(resolve=>grant=resolve)});
  const pending=f.controller.start('en-US');f.controller.cancel();
  grant({getTracks:()=>[{stop:()=>stopped++}]});await pending;
  assert.equal(stopped,1);assert.equal(f.instances.length,0);assert.deepEqual(f.texts,[]);
});
test('microphone denial is actionable and cannot start a speech service', async()=>{
  const f=fixture({getUserMedia:async()=>{throw {name:'NotAllowedError'}}});await f.controller.start('en-US');
  assert.equal(f.instances.length,0);assert.match(f.states.at(-1).message,/denied/);assert.equal(f.timers.size,0);
});
test('missing speech API displays an unsupported state without requesting a microphone', async()=>{
  const f=fixture({Recognition:undefined});await f.controller.start('en-US');assert.equal(f.requested,0);assert.match(f.states.at(-1).message,/not supported/);
});
test('silence, network, access and language failures release recognition and report helpful feedback', async()=>{
  for(const code of ['no-speech','network','not-allowed','service-not-allowed','audio-capture','language-not-supported']){
    const f=fixture();await f.controller.start('en-US');f.instances[0].onerror({error:code});assert.equal(f.instances[0].aborts,1);assert.equal(f.states.at(-1).message,voiceErrorMessage(code));assert.equal(f.timers.size,0);
  }
});
test('a silent natural end and timeout do not leave the microphone running', async()=>{
  const f=fixture();await f.controller.start('en-US');f.instances[0].onend();assert.match(f.states.at(-1).message,/No speech/);
  await f.controller.start('en-US');[...f.timers.values()][0]();assert.match(f.states.at(-1).message,/timed out/);assert.equal(f.instances[1].aborts,1);
});
test('duplicate starts cannot create simultaneous recognizers; synchronous failures can retry', async()=>{
  const f=fixture();await Promise.all([f.controller.start('en-US'),f.controller.start('en-US')]);assert.equal(f.instances.length,1);f.controller.dispose();
  let attempts=0;class Failing {start(){attempts++;throw new Error('rejected')}abort(){}}
  const bad=fixture({Recognition:Failing});await bad.controller.start('en-US');await bad.controller.start('en-US');assert.equal(attempts,2);assert.equal(bad.timers.size,0);
});
test('image validation permits common formats, rejects empty/oversized/non-image files',()=>{
  for(const type of ['image/png','image/jpeg','image/webp']) assert.equal(validateSearchImage({type,size:100,name:'image'}),'');
  assert.equal(validateSearchImage({type:'',size:100,name:'photo.JPG'}),'');
  for(const file of [null,{type:'image/svg+xml',size:100},{type:'text/html',size:100,name:'fake.png'},{type:'image/png',size:0},{type:'image/png',size:11*1024*1024}]) assert.ok(validateSearchImage(file));
});
test('image handoffs expose only official interactive pages without filenames or private upload APIs',()=>{
  assert.deepEqual(Object.keys(IMAGE_SEARCH_PROVIDERS),['google','bing']);
  for(const provider of Object.values(IMAGE_SEARCH_PROVIDERS)) {const url=new URL(provider.url);assert.equal(url.protocol,'https:');assert.equal(url.search,'');assert.doesNotMatch(url.pathname,/upload|searchbyimage/);}
});
