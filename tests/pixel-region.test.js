import assert from 'node:assert/strict';
import test from 'node:test';
import { marqueePoints, regionBounds, validRegion } from '../js/model/pixel-region.js';
import { createDocument, createLayer, validateDocument } from '../js/model/document.js';
import { localToWorld, worldToLocal } from '../js/interaction/geometry.js';
import { History, patchCommand } from '../js/history/history.js';

test('marquees normalize reverse drags and clip crop bounds to source pixels', () => {
  const rect = marqueePoints({x:.8,y:.9},{x:.2,y:.1});
  assert.deepEqual(regionBounds(rect,100,100),{x:20,y:10,width:60,height:80});
  const ellipse=marqueePoints({x:-.2,y:.1},{x:1.2,y:.9},true);
  assert.equal(ellipse.length,128);assert.ok(validRegion(ellipse));
  assert.deepEqual(regionBounds(ellipse,100,100),{x:0,y:10,width:100,height:80});
  assert.equal(regionBounds(marqueePoints({x:2,y:2},{x:3,y:3}),100,100).width,0);
});
test('selection coordinates round-trip under rotation, scaling and both flips', () => {
  const t={x:230,y:190,width:400,height:200,rotation:63,flipX:true,flipY:true};
  for(const p of marqueePoints({x:.2,y:.1},{x:.7,y:.8},true)) {
    const world=localToWorld({x:(p.x-.5)*t.width,y:(p.y-.5)*t.height},t),local=worldToLocal(world,t);
    assert.ok(Math.abs(local.x/t.width+.5-p.x)<1e-12);assert.ok(Math.abs(local.y/t.height+.5-p.y)<1e-12);
  }
});
test('pixel masks serialize, validate and undo without changing image asset references', () => {
  const doc=createDocument(),layer=createLayer('image',doc.canvas,{assetId:'original'});
  doc.assets.push({id:'original',name:'Source'});doc.layers.push(layer);
  const history=new History(),points=marqueePoints({x:.1,y:.2},{x:.8,y:.9});
  history.execute(patchCommand(layer,{eraseRegions:undefined},{eraseRegions:[points]},'Delete pixels'));
  assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(doc))).layers[0].eraseRegions,[points]);
  history.undo();assert.equal(layer.eraseRegions,undefined);history.redo();assert.equal(layer.assetId,'original');
  layer.eraseRegions=[[{x:NaN,y:0},{x:0,y:0},{x:1,y:1}]];assert.throws(()=>validateDocument(doc),/pixel edits/);
  assert.equal(validRegion(Array(4097).fill({x:0,y:0})),false);
});
