import test from 'node:test';
import assert from 'node:assert/strict';
import { localToWorld, worldToLocal, hitTest, resizeTransform } from '../js/interaction/geometry.js';
const t = { x: 150, y: 90, width: 200, height: 100, rotation: 37, flipX: true, flipY: false };
const near = (a,b) => assert.ok(Math.abs(a-b) < .000001, `${a} != ${b}`);
test('inverse geometry handles arbitrary rotation and flips', () => {
  const original = { x: 81, y: -33 }, result = worldToLocal(localToWorld(original, t), t); near(result.x, original.x); near(result.y, original.y);
});
test('hit test is topmost-first and skips hidden or locked objects', () => {
  const a = { id:'a', visible:true, locked:false, transform:t }, b = { ...a, id:'b' };
  assert.equal(hitTest([a,b], t).id,'b'); b.locked = true; assert.equal(hitTest([a,b],t).id,'a'); a.visible = false; assert.equal(hitTest([a,b],t),null);
});
test('rotated corner resize fixes the opposite corner', () => {
  const plain = { ...t, flipX:false }, next = resizeTransform(plain, [1,1], { x:45, y:15 });
  const a = localToWorld({ x:-plain.width/2, y:-plain.height/2 },plain), b = localToWorld({ x:-next.width/2, y:-next.height/2 },next);
  near(a.x,b.x); near(a.y,b.y);
});
test('modifier resize preserves ratio and centre and never crosses zero', () => {
  const next = resizeTransform(t,[1,1],{ x:45,y:15 },{ shift:true,alt:true }); near(next.width/next.height,2); near(next.x,t.x); near(next.y,t.y);
  assert.ok(resizeTransform(t,[1,0],{ x:-1e6,y:0 }).width >= 1);
});
