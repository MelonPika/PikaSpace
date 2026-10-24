import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const source = (await readFile(new URL('../public/background.js', import.meta.url), 'utf8')).replace(/^import .*;\n/, '');
function worker(fetch = () => assert.fail('Unexpected network request')) {
  let listener;
  const context = { chrome: { runtime: { id: 'pikanav', getURL: path => `chrome-extension://pikanav/${path}`, onMessage: { addListener: value => listener = value } } },
    fetch, AbortController, setTimeout, clearTimeout, handleMediaCommand: async () => ({ ok: true }) };
  vm.createContext(context); vm.runInContext(source, context);
  return { context, listener };
}
test('worker rejects privileged requests from websites or other extensions', () => {
  const { listener } = worker();
  for (const sender of [{ id: 'other', url: 'chrome-extension://other/page' }, { id: 'pikanav', url: 'https://example.com' }, {}]) {
    assert.equal(listener({ type: 'GET_NEWS_FEED' }, sender, () => assert.fail('Untrusted request accepted')), false);
  }
});
test('worker accepts its own extension page and rejects unknown commands', () => {
  const { listener } = worker();
  let response;
  listener({ type: 'mediaCommand', command: 'deleteEverything' }, { id: 'pikanav', url: 'chrome-extension://pikanav/index.html' }, value => response = value);
  assert.equal(response.ok, false);
});
test('unavailable native metrics remain null rather than becoming fake zeroes', () => {
  const { context } = worker();
  for (const value of [null, undefined, '', 'bad']) { assert.equal(context.pickPercent(value), null); assert.equal(context.pickNumber(value), null); }
  assert.equal(context.pickPercent(125), 100);
  assert.equal(context.pickPercent(-4), 0);
});
test('Perplexity has no autocomplete endpoint and does not send input to Google', async () => {
  assert.deepEqual(Array.from(await worker().context.getSearchSuggestions({ query: 'private query', engine: 'perplexity' })), []);
});
test('DuckDuckGo empty results do not disclose the query to another provider', async () => {
  const urls = [];
  const { context } = worker(async url => { urls.push(url); return { ok: true, json: async () => [] }; });
  assert.equal((await context.getSearchSuggestions({ query: 'test', engine: 'duckduckgo' })).length, 0);
  assert.equal(urls.length, 1); assert.match(urls[0], /duckduckgo/);
});
test('suggestion HTTP failures return a recoverable error', async () => {
  const { context } = worker(async () => ({ ok: false, status: 503 }));
  await assert.rejects(context.getSearchSuggestions({ query: 'test' }), /503/);
});
