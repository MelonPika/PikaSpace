import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extensionIdFromKey } from '../scripts/extension-identity.mjs';

const root = path.resolve('.verification/companion/detector-tests');
const detector = path.resolve('.verification/companion/detector/PikaNav.ExtensionDetector.exe');
await mkdir(root, { recursive: true });
const id = character => character.repeat(32);
const baseManifest = JSON.parse(await readFile('public/manifest.json', 'utf8'));

async function fixture() {
  const directory = await mkdtemp(path.join(root, 'profile-'));
  const data = path.join(directory, "Chrome Data's 猫");
  await mkdir(data);
  return { directory, data, output: path.join(directory, 'detected.txt') };
}
async function extension(folder, overrides = {}, worker = 'const host = "com.pikanav.media"; const command = "getSystemStats";') {
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, 'manifest.json'), JSON.stringify({ ...baseManifest, ...overrides }));
  await writeFile(path.join(folder, 'index.html'), '<!doctype html>');
  await writeFile(path.join(folder, 'background.js'), worker);
}
async function preferences(data, profile, settings, filename = 'Preferences') {
  const profileDir = path.join(data, profile);
  await mkdir(profileDir, { recursive: true });
  const file = path.join(profileDir, filename);
  await writeFile(file, JSON.stringify({ extensions: { settings } }));
  return file;
}
function detect({ data, output }) {
  const result = spawnSync(detector, ['--user-data-dir', data, '--output', output], { windowsHide: true });
  if (result.error) throw result.error;
  return result.status;
}

test('release identity is persistent and valid', () => {
  assert.equal(extensionIdFromKey(baseManifest.key), 'abipfjhfejgjkhcpilkfdhbgaepljpki');
  assert.throws(() => extensionIdFromKey('not a public key'));
});

test('detects legacy and rebranded copies across profiles without modifying preferences', async () => {
  const f = await fixture();
  try {
    const unpacked = path.join(f.directory, 'unpacked');
    const installed = path.join(f.data, 'Profile 2', 'Extensions', id('b'), '1.0.0_0');
    await extension(unpacked, { name: "PikaNav", key: undefined });
    await extension(installed);
    const first = await preferences(f.data, 'Default', { [id('a')]: { path: unpacked, state: 1 } });
    const second = await preferences(f.data, 'Profile 2', { [id('b')]: { path: `${id('b')}/1.0.0_0`, state: 1 } }, 'Secure Preferences');
    await preferences(f.data, 'Profile 3', { [id('a')]: { path: unpacked, state: 1 } });
    const hash = async file => createHash('sha256').update(await readFile(file)).digest('hex');
    const before = await Promise.all([hash(first), hash(second)]);
    assert.equal(detect(f), 0);
    assert.equal(await readFile(f.output, 'utf8'), `${id('a')},${id('b')}`);
    assert.deepEqual(await Promise.all([hash(first), hash(second)]), before);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test('rejects unrelated, disabled, malformed, missing, and name-only matches', async () => {
  const f = await fixture();
  try {
    const valid = path.join(f.directory, 'valid');
    const fake = path.join(f.directory, 'name-only');
    const other = path.join(f.directory, 'other');
    await extension(valid);
    await extension(fake, {}, 'const host = "other.host";');
    await extension(other, { name: 'Another dashboard' });
    await preferences(f.data, 'Default', {
      [id('a')]: { path: fake, state: 1 },
      [id('b')]: { path: other, state: 1 },
      [id('c')]: { path: valid, state: 2 },
      [id('d')]: { path: valid, state: 1, disable_reasons: [1] },
      [id('e')]: { path: path.join(f.directory, 'missing'), state: 1 },
      'INVALID': { path: valid, state: 1 },
      [id('f')]: { path: '//server/share', state: 1 },
    });
    await preferences(f.data, 'Profile 1', { [id('g')]: { path: valid, state: 1 } });
    await preferences(f.data, 'Profile 1', { [id('g')]: { path: valid, state: 2 } }, 'Secure Preferences');
    await mkdir(path.join(f.data, 'Profile 2'));
    await writeFile(path.join(f.data, 'Profile 2', 'Preferences'), '{half-written json');
    assert.equal(detect(f), 0);
    assert.equal(await readFile(f.output, 'utf8'), '');
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});

test('too many detected IDs causes fallback instead of silently authorizing a subset', async () => {
  const f = await fixture();
  try {
    const folder = path.join(f.directory, 'extension');
    await extension(folder);
    const settings = Object.fromEntries([...Array(11)].map((_, i) => [id(String.fromCharCode(97 + i)), { path: folder, state: 1 }]));
    await preferences(f.data, 'Default', settings);
    assert.equal(detect(f), 1);
  } finally { await rm(f.directory, { recursive: true, force: true }); }
});
