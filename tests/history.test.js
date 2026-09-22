import test from 'node:test';
import assert from 'node:assert/strict';
import { History, patchCommand, insertCommand, deleteCommand, orderCommand } from '../js/history/history.js';
test('commands reverse layer creation, ordering and deletion', () => {
  const doc = { layers: [] }, a = { id:'a' }, b = { id:'b' }, h = new History();
  h.execute(insertCommand(doc,a)); h.execute(insertCommand(doc,b)); h.execute(orderCommand(doc,a,1)); assert.deepEqual(doc.layers,[b,a]);
  h.execute(deleteCommand(doc,b)); h.undo(); h.undo(); assert.deepEqual(doc.layers,[a,b]); h.undo(); assert.deepEqual(doc.layers,[a]); h.redo(); assert.deepEqual(doc.layers,[a,b]);
});
test('one committed gesture makes one history entry and supports saved-state tracking', () => {
  const layer = { transform: { x:0 } }, h = new History();
  for(let x=0;x<100;x++) layer.transform.x=x;
  h.record(patchCommand(layer,{transform:{x:0}},{transform:{x:99}})); h.markSaved(); assert.equal(h.dirty,false); assert.equal(h.undoStack.length,1);
  h.undo(); assert.equal(layer.transform.x,0); assert.equal(h.dirty,true); h.redo(); assert.equal(h.dirty,false);
  h.undo(); h.execute(patchCommand(layer,{transform:{x:0}},{transform:{x:55}})); assert.equal(h.redoStack.length,0);
});
test('saved checkpoint does not swallow changes made during an asynchronous save', () => {
  const item = { value:0 }, h = new History(); h.execute(patchCommand(item,{value:0},{value:1})); const savedState = h.state;
  h.execute(patchCommand(item,{value:1},{value:2})); h.markSaved(savedState); assert.equal(h.dirty,true);
});
