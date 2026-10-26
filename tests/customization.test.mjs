import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_COLORS, normalizeHex, normalizeColors, normalizeWidgetOrder, WIDGET_IDS, contrastText, readableAccent, luminance, resolveTheme } from '../src/app/customization.mjs';
import { WALLPAPERS, normalizeBackground } from '../src/app/wallpapers.mjs';
import { readFile } from 'node:fs/promises';

test('HEX accepts short and full colors, rejects malformed or executable input', () => {
  assert.equal(normalizeHex(' #AbC '), '#aabbcc');
  assert.equal(normalizeHex('123456'), '#123456');
  for (const value of [null, {}, '#12', '#1234', '#12345678', '#gggggg', 'red', 'url(x)', '']) assert.equal(normalizeHex(value), null);
});
test('old or corrupt color settings get safe defaults without losing valid fields', () => {
  assert.deepEqual(normalizeColors(undefined), DEFAULT_COLORS);
  assert.deepEqual(normalizeColors({ accent:'#ABC', background:'nope', card:'#ffffff', extra:'bad' }), { accent:'#aabbcc', background:DEFAULT_COLORS.background, card:'#ffffff' });
});
test('corrupt and outdated widget orders retain every supported widget exactly once', () => {
  for (const value of [undefined, {}, [null,'calendar','notes','notes','removed','clock']]) {
    const normalized = normalizeWidgetOrder(value);
    assert.equal(normalized.length, WIDGET_IDS.length);
    assert.deepEqual([...normalized].sort(), [...WIDGET_IDS].sort());
  }
  assert.equal(normalizeWidgetOrder(['notes','clock'])[0], 'notes');
});
test('custom accent and filled-control text stay readable at color extremes', () => {
  const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  for (const color of ['#000000','#ffffff','#ff0000','#00ff00','#0000ff','#777777','#ffff00','#123456']) {
    assert.ok(contrast(color, contrastText(color)) >= 4.5, color);
    assert.ok(contrast(readableAccent(color, false),'#0a101e') >= 4.5, `dark ${color}`);
    assert.ok(contrast(readableAccent(color, true),'#f1f5f9') >= 4.5, `light ${color}`);
  }
});

test('explicit themes override the system preference while Auto follows it', () => {
  for (const systemLight of [true, false]) {
    assert.equal(resolveTheme('light', systemLight), 'light');
    assert.equal(resolveTheme('dark', systemLight), 'dark');
    assert.equal(resolveTheme('auto', systemLight), systemLight ? 'light' : 'dark');
  }
});

test('old backgrounds migrate without losing custom colors or uploaded wallpapers', () => {
  for (const [oldId, id] of [['abstract','forest'],['gradient','coast'],['solid-dark','solid'],['bad','aurora']]) assert.equal(normalizeBackground({wallpaper:oldId}).wallpaper,id);
  assert.deepEqual(normalizeBackground({wallpaper:'aurora',customSurfaces:true},'#abc'),{wallpaper:'solid',wallpaperColor:'#aabbcc'});
  assert.equal(normalizeBackground({wallpaper:'custom',customSurfaces:true},'#fff').wallpaper,'custom');
  assert.deepEqual(normalizeBackground({wallpaper:'forest',customSurfaces:true,wallpaperColor:'#fff'}),{wallpaper:'forest',wallpaperColor:'#ffffff'});
  assert.deepEqual(normalizeBackground({wallpaper:'solid',wallpaperColor:'url(x)'}),{wallpaper:'solid',wallpaperColor:DEFAULT_COLORS.background});
  assert.equal(normalizeBackground(null).wallpaper,'aurora');
});

test('all six licensed wallpapers and matching previews are bundled as real WebP assets', async () => {
  const credits=await readFile(new URL('../public/wallpapers/CREDITS.txt',import.meta.url),'utf8');
  assert.equal(WALLPAPERS.length,6);
  for (const item of WALLPAPERS) {
    assert.ok(credits.includes(item.source.split('/').at(-1)));
    for (const filename of [item.image,item.thumbnail]) {
      const bytes=await readFile(new URL(`../public/${filename}`,import.meta.url));
      assert.equal(bytes.subarray(0,4).toString(),'RIFF');
      assert.equal(bytes.subarray(8,12).toString(),'WEBP');
      assert.ok(bytes.length>1000);
    }
  }
});
