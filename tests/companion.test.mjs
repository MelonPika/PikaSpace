import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyCompanionError, createCompanionClient } from '../public/companion.js';

test('only observable native failures are classified; exiting is not an absent installation', () => {
  for (const [error, state] of [
    ['Specified native messaging host not found.', 'not-detected'],
    ['Native host has exited.', 'disconnected'],
    ['Access to the specified native messaging host is forbidden.', 'permission-error'],
    ['Unknown command', 'incompatible'], ['Native host returned an invalid response.', 'incompatible'],
    ['Windows companion timed out.', 'communication-error'], ['Something unexpected', 'communication-error'],
  ]) assert.equal(classifyCompanionError(error), state, error);
});
test('missing companion uses shared exponential backoff and bounds native attempts', async () => {
  let time = 0, calls = 0;
  const client = createCompanionClient(async () => { calls++; return { ok:false, error:'Specified native messaging host not found.' }; }, { now:() => time });
  await Promise.all(Array.from({length:10}, () => client.call({type:'getSystemStats'})));
  assert.equal(calls, 1);
  for (let i=0;i<20;i++) await client.call({type:i%2 ? 'getSystemStats':'getCurrentMedia'});
  assert.equal(calls, 1);
  assert.equal((await client.snapshot()).nextRetryAt, 60000);
  time = 60000; await client.call({type:'getSystemStats'});
  assert.equal(calls, 2); assert.equal((await client.snapshot()).nextRetryAt, 180000);
  for (let i=0;i<6;i++) { time=(await client.snapshot()).nextRetryAt; await client.call({type:'ping'}); assert.ok((await client.snapshot()).nextRetryAt-time <= 300000); }
});
test('explicit retry bypasses backoff, is rate limited, and restores native features', async () => {
  let time=0, online=false, calls=0;
  const client=createCompanionClient(async payload => { calls++; return online ? payload.type==='ping' ? {ok:true,version:'1.0.0'} : {ok:true,cpu:{usagePercent:42}} : {ok:false,error:'Native host has exited.'}; }, {now:()=>time});
  await client.call({type:'getSystemStats'});
  online=true;
  assert.equal((await client.call({type:'ping'},true)).companion.state, 'connected');
  const before=calls; await client.call({type:'ping'},true); assert.equal(calls,before);
  assert.equal((await client.call({type:'getSystemStats'})).cpu.usagePercent,42);
});
test('unsupported companion versions and malformed replies fail clearly', async () => {
  for (const response of [{ok:true,version:'2.0.0'}, {ok:true}, null]) {
    const client=createCompanionClient(async()=>response);
    assert.equal((await client.call({type:'getSystemStats'})).companion.state,'incompatible');
  }
});
test('retry revalidates the version even after a successful connection', async () => {
  let time=0, version='1.0.0';
  const client=createCompanionClient(async()=>({ok:true,version}),{now:()=>time});
  assert.equal((await client.call({type:'ping'},true)).companion.state,'connected');
  time=3000; version='2.0.0';
  assert.equal((await client.call({type:'ping'},true)).companion.state,'incompatible');
});
test('communication failures after connection downgrade state; valid rejected media actions do not', async () => {
  let failure={ok:false,error:'This player rejected the action.'};
  const client=createCompanionClient(async payload => payload.type==='ping' ? {ok:true,version:'1.0.0'} : failure);
  assert.equal((await client.call({type:'playPause'})).companion.state,'connected');
  failure={ok:false,error:'Native host has exited.',transportError:true};
  assert.equal((await client.call({type:'getSystemStats'})).companion.state,'disconnected');
});
test('MV3 suspension retains negative-cache cooldown using session storage', async () => {
  let saved={}, calls=0;
  const storage={get:async()=>saved,set:async value=>{saved=value;}};
  const request=async()=>{calls++;return {ok:false,error:'Specified native messaging host not found.'};};
  await createCompanionClient(request,{now:()=>1000,storage}).call({type:'ping'});
  await createCompanionClient(request,{now:()=>2000,storage}).call({type:'getCurrentMedia'});
  assert.equal(calls,1);
});
