import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocument, createLayer, migrateDocument, validateDocument } from '../js/model/document.js';
import { validGradient, pathBounds, validPath } from '../js/model/vector.js';
import { floodFill } from '../js/rendering/flood-fill.js';
import { strokeSamples, sourcePoint } from '../js/rendering/paint.js';
import { localToWorld } from '../js/interaction/geometry.js';
import { AssetStore } from '../js/storage/assets.js';

test('paint coordinates account for nonuniform scaling, rotation and flips',()=>{
  const t={x:80,y:60,width:200,height:100,rotation:37,flipX:true,flipY:true};
  const p=sourcePoint(localToWorld({x:30,y:-20},t),t,1000,300);
  assert.ok(Math.abs(p.x-650)<1e-8);assert.ok(Math.abs(p.y-90)<1e-8);
  const samples=strokeSamples({x:0,y:0},{x:100,y:0},20);
  assert.equal(samples.length,50);assert.deepEqual(samples.at(-1),{x:100,y:0});
});
test('fill respects connectivity, tolerance and selection barriers',()=>{
  const pixels=new Uint8ClampedArray([10,10,10,255, 12,12,12,255, 255,255,255,255, 10,10,10,255]);
  floodFill(pixels,4,1,0,0,[200,0,0],1,2);
  assert.deepEqual([...pixels],[200,0,0,255,200,0,0,255,255,255,255,255,10,10,10,255]);
  const mask=new Uint8ClampedArray([0,0,0,255,0,0,0,0,0,0,0,255]);
  const data=new Uint8ClampedArray(12);floodFill(data,3,1,0,0,[0,200,0],1,0,mask);
  assert.equal(data[3],255);assert.equal(data[11],0);
});
test('transparent fill ignores hidden RGB and uses source-over opacity',()=>{
  const data=new Uint8ClampedArray([255,0,10,0, 0,250,0,0]);
  floodFill(data,2,1,0,0,[20,40,60],.5,0);
  assert.deepEqual([...data],[20,40,60,128,20,40,60,128]);
  floodFill(data,2,1,-1,0,[0,0,0],1,255);assert.equal(data[0],20);
});
test('version-one migration preserves shapes, images and erasures without mutating input',()=>{
  const doc=createDocument();doc.version=1;doc.layers.push(createLayer('shape',doc.canvas));
  const loaded=migrateDocument(doc);assert.equal(loaded.version,2);assert.equal(doc.version,1);assert.deepEqual(loaded.layers,doc.layers);
  assert.throws(()=>migrateDocument({...doc,version:99}),/version/);
});
test('paths and gradients validate and bounds include curve handles',()=>{
  const anchors=[{x:0,y:0,in:{x:-.5,y:0},out:{x:.3,y:.7}},{x:1,y:1,in:{x:.7,y:.3},out:{x:1,y:1}}];
  const doc=createDocument(),l=createLayer('shape',doc.canvas);doc.layers.push(l);Object.assign(l.shape,{kind:'path',anchors,closed:true});
  const g={type:'linear',start:{x:0,y:0},end:{x:1,y:0},stops:[{offset:0,colour:'#000000',opacity:1},{offset:1,colour:'#ffffff',opacity:0}]};
  l.shape.gradient=g;assert.equal(validateDocument(doc),doc);assert.equal(pathBounds(anchors).x,-.5);assert.ok(validPath(l.shape));
  assert.ok(!validGradient({...g,end:g.start}));assert.ok(!validGradient({...g,stops:[...g.stops].reverse()}));
  l.shape.closed=false;assert.throws(()=>validateDocument(doc),/gradient/);
});
test('asset collection retains current, undo and redo sources and releases discarded branches',()=>{
  const assets=new AssetStore(),closed=[];
  for(const id of ['current','undo','redo','discarded']){assets.blobs.set(id,{});assets.images.set(id,{close:()=>closed.push(id)});}
  const doc={layers:[{assetId:'current'}],assets:[...assets.blobs.keys()].map(id=>({id}))};
  const history={undoStack:[{assetIds:['undo']}],redoStack:[{assetIds:['redo']}]};
  assets.collect(doc,history);assert.deepEqual(closed,['discarded']);assert.equal(assets.blobs.size,3);
  history.redoStack=[];assets.collect(doc,history);assert.deepEqual(closed,['discarded','redo']);assert.deepEqual(doc.assets.map(a=>a.id),['current','undo']);
});
