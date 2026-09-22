import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, createLayer, validateDocument } from '../js/model/document.js';
import { setEffect } from '../js/model/effects.js';
test('editable document serialises without binary assets or runtime state', () => {
  const doc = createDocument(); doc.layers.push(createLayer('text', doc.canvas), createLayer('shape', doc.canvas));
  setEffect(doc.layers[0], 'dither', { intensity: .6 });
  assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(doc))), doc);
  assert.equal(doc.layers[0].text.content, 'Text');
});
test('project validation rejects unsupported versions, missing assets and bad dimensions', () => {
  assert.throws(() => validateDocument({ version: 999 }), /version/);
  assert.throws(() => createDocument({ width: 0, height: 100 }), /dimensions/);
  assert.throws(() => createDocument({ width: 8192, height: 8192 }), /32 million/);
  const doc = createDocument(); doc.layers.push(createLayer('image', doc.canvas));
  assert.throws(() => validateDocument(doc), /missing asset/);
});
test('effects are identifiable and inserted in processing order regardless of edit order', () => {
  const layer = createLayer('shape', { width: 400, height: 400 });
  setEffect(layer, 'drop-shadow', { enabled: true }); setEffect(layer, 'dither', { intensity: .2 }); setEffect(layer, 'brightness', { amount: 30 });
  assert.deepEqual(layer.effects.map(e => e.type), ['brightness', 'dither', 'drop-shadow']);
  const id = layer.effects[1].id; setEffect(layer, 'dither', { intensity: .9 }); assert.equal(layer.effects[1].id, id);
});
test('invalid effect parameters and text styles are rejected before rendering', () => {
  const doc = createDocument(); const layer=createLayer('text',doc.canvas);doc.layers.push(layer);setEffect(layer,'blur',{radius:-1});
  assert.throws(()=>validateDocument(doc),/effect settings/);layer.effects=[];layer.text.fontFamily=null;assert.throws(()=>validateDocument(doc),/text layer/);
});
