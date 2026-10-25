import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_COLORS, normalizeHex, normalizeColors, normalizeWidgetOrder, WIDGET_IDS, contrastText, readableAccent, luminance } from '../src/app/customization.mjs';

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
