import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.DITHER_PLAYWRIGHT_PATH ? pathToFileURL(resolve(process.env.DITHER_PLAYWRIGHT_PATH)).href : 'playwright');
const browser = await chromium.launch({channel:process.env.DITHER_BROWSER || 'msedge',headless:true});
const page = await browser.newPage({viewport:{width:1280,height:900}}), errors=[];
page.on('pageerror',e=>errors.push(e.message));await mkdir('.test-results',{recursive:true});
const points = () => page.locator('[data-endpoint]').evaluateAll(els=>els.map(el=>({x:Number(el.getAttribute('cx')),y:Number(el.getAttribute('cy'))})));
const near = (a,b) => assert.ok(Math.abs(a-b)<.001,`${a} != ${b}`);
try {
  await page.goto(process.env.DITHER_URL || 'http://127.0.0.1:4173/');await page.locator('#new-dialog [data-close]').click();
  for(const kind of ['line','arrow']) {
    await page.locator(`[data-action=${kind}]`).click();assert.equal(await page.locator('[data-endpoint]').count(),2);assert.equal(await page.locator('[data-handle],[data-rotate],#overlay rect').count(),0);
    const before=await points(),historyCount=await page.locator('[data-history-state]').count();
    const handle=await page.locator('[data-endpoint="1"]').boundingBox();
    await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+110,handle.y+handle.height/2+55,{steps:12});await page.mouse.up();
    const after=await points();near(before[0].x,after[0].x);near(before[0].y,after[0].y);assert.ok(Math.hypot(after[1].x-before[1].x,after[1].y-before[1].y)>100);
    assert.equal(await page.locator('[data-history-state]').count(),historyCount+1);
    await page.keyboard.press('Control+z');assert.deepEqual(await points(),before);await page.keyboard.press('Control+Shift+z');assert.deepEqual(await points(),after);
    // A cancelled endpoint drag leaves both the document and history unchanged.
    const start=await page.locator('[data-endpoint="0"]').boundingBox();await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down();await page.mouse.move(start.x-40,start.y-60,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();await page.locator('.layer-select').first().click();assert.deepEqual(await points(),after);assert.equal(await page.locator('[data-history-state]').count(),historyCount+1);
  }
  // Save/reopen retains the ordinary transform representation used by existing projects.
  const savedPoints=await points();await page.locator('#workspace').focus();await page.keyboard.press('Control+s');await page.getByRole('status').filter({hasText:'Project saved on this device.'}).waitFor();
  await page.reload();await page.locator('#new-dialog [data-action=open]').click();await page.locator('[data-project]').click();await page.locator('.layer-select').first().click();assert.deepEqual(await points(),savedPoints);
  const pixels=await page.evaluate(async()=>{
    const {DocumentRenderer}=await import('./js/rendering/renderer.js'),{createDocument,createLayer}=await import('./js/model/document.js'),{AssetStore}=await import('./js/storage/assets.js');
    const doc=createDocument({width:320,height:240}),layer=createLayer('shape',doc.canvas);layer.shape={...layer.shape,kind:'arrow',stroke:'#ffffff',strokeWidth:20,strokeOpacity:.5,arrowSize:40,startArrow:true,endArrow:true};
    layer.transform={...layer.transform,x:160,y:120,width:200,height:1,rotation:Math.atan2(1,200)*180/Math.PI};doc.layers=[layer];
    const renderer=new DocumentRenderer(),canvas=document.createElement('canvas');await renderer.renderDocument(doc,new AssetStore(),canvas);const ctx=canvas.getContext('2d'),alpha=(x,y)=>ctx.getImageData(x,y,1,1).data[3];
    return {pastStart:alpha(55,120),pastEnd:alpha(265,120),shaft:alpha(160,120),head:alpha(240,120),join:alpha(220,120)};
  });assert.equal(pixels.pastStart,0);assert.equal(pixels.pastEnd,0);for(const key of ['shaft','head','join'])assert.ok(Math.abs(pixels[key]-128)<=1,JSON.stringify(pixels));
  await page.waitForFunction(()=>document.querySelector('#workspace').getAttribute('aria-busy')==='false');await page.screenshot({path:'.test-results/line-endpoints.png'});
  await page.context().setOffline(true);await page.reload();await page.locator('#new-dialog [data-action=open]').click();await page.locator('[data-project]').click();await page.locator('.layer-select').first().click();assert.equal(await page.locator('[data-endpoint]').count(),2);
  assert.deepEqual(errors,[]);console.log('PASS line/arrow endpoint dragging, fixed opposite point, one history command, undo/redo, cancel, save/reopen/offline and arrow tip/opacity pixels.');
}catch(error){await page.screenshot({path:'.test-results/line-editing-failure.png'});throw error;}finally{await browser.close();}
