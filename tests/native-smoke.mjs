import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { once } from 'node:events';

const work = path.resolve('.verification');
const args = process.argv.slice(2);
function argument(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  assert.ok(args[index + 1] && !args[index + 1].startsWith('--'), `${name} needs a value`);
  return path.resolve(args[index + 1]);
}
const host = argument('--host', path.join(work, 'native-build', 'PikaNav.MediaHost.exe'));
const resultPath = argument('--result-path', path.join(work, 'native-results.json'));
const localData = path.join(work, 'native-local-data');
await mkdir(localData, {recursive:true});
const child = spawn(host, [], {windowsHide:true, stdio:['pipe','pipe','pipe'], env:{...process.env, LOCALAPPDATA:localData, DOTNET_ROOT:path.join(work,'no-shared-runtime'), DOTNET_MULTILEVEL_LOOKUP:'0'}});
// Handle spawn/early-exit failures immediately instead of hanging for each request.
let processError;
child.on('error', error => { processError = error; });
let buffer = Buffer.alloc(0);
const waiting = [];
let stderr = '';
child.stderr.on('data',data=>{stderr += data;});
child.stdout.on('data',data=>{
  buffer=Buffer.concat([buffer,data]);
  while(buffer.length>=4 && buffer.length>=4+buffer.readUInt32LE(0)) {
    const length=buffer.readUInt32LE(0);
    const message=JSON.parse(buffer.subarray(4,4+length).toString());
    buffer=buffer.subarray(4+length);
    waiting.shift()?.(message);
  }
});
async function request(raw) {
  if (processError) throw processError;
  assert.equal(child.exitCode, null, 'Native host exited before the request');
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Native response timed out: '+stderr)),10000);
    waiting.push(value=>{clearTimeout(timer);resolve(value);});
    const bytes=Buffer.from(raw);
    const header=Buffer.alloc(4);header.writeUInt32LE(bytes.length);
    child.stdin.write(Buffer.concat([header,bytes]));
  });
}
try {
  const ping=await request('{"type":"ping"}');
  assert.equal(ping.ok,true);
  assert.equal(ping.host, 'PikaNav.MediaHost');
  const stats=await request('{"type":"getSystemStats"}');
  assert.equal(stats.ok,true);
  assert.ok(stats.memory.totalMb>0);
  assert.ok(stats.cpu.usagePercent>=0 && stats.cpu.usagePercent<=100);
  assert.equal(stats.gpu.usagePercent, null);
  const media=await request('{"type":"getCurrentMedia"}');
  assert.equal(media.ok,true);
  assert.equal(typeof media.hasSession,'boolean');
  assert.equal((await request('{"type":"unsupported"}')).ok,false);
  assert.equal((await request('{bad json}')).ok,false);
  const exited = once(child, 'exit');
  child.stdin.end();
  let exitTimer;
  try {
    const [code] = await Promise.race([exited, new Promise((_, reject) => {
      exitTimer = setTimeout(() => reject(new Error('Helper did not exit after Chrome disconnected')), 5000);
    })]);
    assert.equal(code, 0);
  } finally { clearTimeout(exitTimer); }
  const results={build:'passed',version:ping.version,ping:'passed',systemStats:'passed',mediaRead:'passed',unknownCommand:'passed',invalidJson:'passed',exitOnDisconnect:'passed',registration:'not performed',desktopMediaControls:'not performed; no live user media was changed'};
  await mkdir(path.dirname(resultPath), {recursive:true});
  await writeFile(resultPath,JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
} finally { if (child.exitCode === null) { child.stdin.end();child.kill(); } }
