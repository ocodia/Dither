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
test('history navigation restores any reachable state with one notification', () => {
  let notifications=0; const h=new History(()=>notifications++), item={value:0};
  for(let n=1;n<=4;n++) h.execute(patchCommand(item,{value:n-1},{value:n},`Change ${n}`));
  h.markSaved(2); notifications=0;
  assert.equal(h.goTo(1),true);assert.equal(item.value,1);assert.equal(notifications,1);
  assert.deepEqual(h.entries.map(entry=>entry.state),[0,1,2,3,4]);
  h.goTo(2);assert.equal(h.dirty,false);h.goTo(4);assert.equal(item.value,4);
  h.goTo(0);assert.equal(item.value,0);assert.equal(h.redoStack.length,4);
  assert.equal(h.goTo(99),false);assert.equal(item.value,0);
});
test('history navigation respects branching, retained baseline and reset', () => {
  const h=new History(),item={value:0};
  for(let n=1;n<=160;n++) h.execute(patchCommand(item,{value:n-1},{value:n}));
  assert.equal(h.entries.length,151);assert.equal(h.entries[0].state,10);
  h.goTo(10);assert.equal(item.value,10);assert.equal(h.goTo(0),false);
  h.execute(patchCommand(item,{value:10},{value:999}));assert.equal(item.value,999);assert.equal(h.goTo(160),false);
  h.goTo(10);assert.equal(item.value,10);h.redo();assert.equal(item.value,999);
  h.reset();assert.deepEqual(h.entries,[{state:0,label:'Initial state'}]);
});
