import assert from 'node:assert/strict';
import test from 'node:test';
import { createDashboardStorage } from '../src/app/dashboard-storage.mjs';

function setup({ local = {}, sync = {}, failRead = [], failWrite = [], webFails = false } = {}) {
  const notices = [];
  const web = new Map();
  const api = { runtime: {}, storage: {} };
  for (const [area, data] of Object.entries({ local, sync })) {
    api.storage[area] = {
      QUOTA_BYTES_PER_ITEM: 8192,
      get(key, callback) {
        api.runtime.lastError = failRead.includes(area) ? { message: 'Read blocked' } : undefined;
        callback({ [key]: data[key] }); api.runtime.lastError = undefined;
      },
      set(values, callback) {
        api.runtime.lastError = failWrite.includes(area) ? { message: 'Write blocked' } : undefined;
        if (!api.runtime.lastError) Object.assign(data, values);
        callback(); api.runtime.lastError = undefined;
      },
    };
  }
  const webStorage = { getItem: key => web.get(key) ?? null, removeItem: key => web.delete(key), setItem: (key, value) => { if (webFails) throw new Error('Full'); web.set(key, value); } };
  return { storage: createDashboardStorage(api, webStorage, message => notices.push(message)), local, sync, notices, web };
}

test('sync settings load without requiring an existing local mirror', async () => {
  const old = { settings: { themeMode: 'light' }, favorites: [], calendarPreference: true };
  const { storage } = setup({ sync: { 'pikanav:data': old } });
  assert.deepEqual(await storage.loadDashboard(), old);
});
test('newest durable copy wins across tab reload and sync recovery', async () => {
  const local = { _pikanavSavedAt: 20, favorites: ['local'] };
  const sync = { _pikanavSavedAt: 10, favorites: ['old'] };
  const { storage } = setup({ local: { 'pikanav:data': local }, sync: { 'pikanav:data': sync } });
  assert.deepEqual(await storage.loadDashboard(), local);
  sync._pikanavSavedAt = 30;
  assert.deepEqual(await storage.loadDashboard(), sync);
});
test('favorites larger than sync quota stay local without a doomed sync write', async () => {
  const { storage, local, sync, notices } = setup();
  const data = { favorites: ['x'.repeat(9000)], _pikanavSavedAt: 1 };
  await storage.write('pikanav:data', data);
  await storage.syncDashboard(data);
  assert.deepEqual(local['pikanav:data'], data);
  assert.equal(sync['pikanav:data'], undefined);
  assert.match(notices[0], /too large/);
});
test('sync failure retains local data and reports the fallback', async () => {
  const { storage, local, notices } = setup({ failWrite: ['sync'] });
  await storage.write('pikanav:data', { favorites: ['keep'] });
  await storage.syncDashboard(local['pikanav:data']);
  assert.deepEqual((await storage.loadDashboard()).favorites, ['keep']);
  assert.match(notices[0], /sync is unavailable/);
});
test('Chrome local failure uses a recoverable browser copy', async () => {
  const { storage, notices } = setup({ failWrite: ['local'] });
  await storage.write('notes', { text: 'Keep me' });
  assert.deepEqual(await storage.read('notes'), { text: 'Keep me' });
  assert.match(notices[0], /recovery copy/);
});
test('read failure never silently supplies defaults that overwrite saved settings', async () => {
  const { storage } = setup({ failRead: ['local', 'sync'] });
  await assert.rejects(storage.loadDashboard(), /existing data has been kept/);
});
test('complete storage failure is reported and rejects the write', async () => {
  const { storage, notices } = setup({ failWrite: ['local'], webFails: true });
  await assert.rejects(storage.write('notes', 'Keep me'), /Write blocked/);
  assert.match(notices[0], /could not be saved/);
});
test('corrupt recovery JSON cannot hide healthy Chrome storage', async () => {
  const {storage,web} = setup({local:{notes:'Durable note'}});
  web.set('notes','{broken');
  assert.equal(await storage.read('notes'),'Durable note');
});
