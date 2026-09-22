import test from 'node:test';
import assert from 'node:assert/strict';
import { localToWorld, worldToLocal, hitTest, resizeTransform, lineEndpoints, moveLineEndpoint } from '../js/interaction/geometry.js';
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
test('line endpoints keep the opposite endpoint fixed across flips and arbitrary directions', () => {
  for (const flipX of [false,true]) for(const flipY of [false,true]) for(const index of [0,1]) {
    const before={...t,flipX,flipY},points=lineEndpoints(before),fixed=points[1-index];
    for(const delta of [{x:180,y:0},{x:0,y:-150},{x:-200,y:40}]) {
      const target={x:fixed.x+delta.x,y:fixed.y+delta.y},next=moveLineEndpoint(before,index,target),after=lineEndpoints(next);
      near(after[1-index].x,fixed.x);near(after[1-index].y,fixed.y);near(after[index].x,target.x);near(after[index].y,target.y);
      assert.equal(next.flipX,flipX);assert.equal(next.flipY,flipY);
    }
  }
});
test('endpoint angle snapping and zero-length drags remain finite and undoable transforms', () => {
  const fixed=lineEndpoints(t)[0],next=moveLineEndpoint(t,1,{x:fixed.x+100,y:fixed.y+42},{shift:true});
  const [a,b]=lineEndpoints(next);near(Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI,30);
  const collapsed=moveLineEndpoint(t,1,fixed);assert.ok(collapsed.width>=1&&collapsed.height>=1);assert.ok(Number.isFinite(collapsed.rotation));
});
test('line selection follows its stroke rather than its empty bounding rectangle', () => {
  const layer={type:'shape',visible:true,locked:false,transform:{...t,rotation:0,flipX:false},shape:{kind:'arrow',strokeWidth:6,strokeOpacity:1,arrowSize:30,startArrow:false,endArrow:true}};
  assert.equal(hitTest([layer],{x:150,y:90}),layer);
  assert.equal(hitTest([layer],{x:65,y:50}),null);
  const tip=lineEndpoints(layer.transform)[1];assert.equal(hitTest([layer],tip),layer);
});
