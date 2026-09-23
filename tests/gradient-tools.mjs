import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.DITHER_PLAYWRIGHT_PATH?pathToFileURL(resolve(process.env.DITHER_PLAYWRIGHT_PATH)).href:'playwright');
const browser=await chromium.launch({channel:process.env.DITHER_BROWSER||'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const ready=()=>page.waitForFunction(()=>document.querySelector('#workspace').getAttribute('aria-busy')==='false');
const count=()=>page.locator('[data-history-state]').count();
const stops=()=>page.locator('.gradient-stop');
const handles=()=>page.locator('[data-gradient-stop]');
async function key(key){await page.locator('#workspace').focus();await page.keyboard.press(key);await ready();}
async function dragHandle(order,offset,cancel=false){
  const h=page.locator(`[data-gradient-stop="${order}"]`),box=await h.boundingBox();
  const a=await page.locator('[data-gradient-handle=start]').boundingBox(),b=await page.locator('[data-gradient-handle=end]').boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(a.x+a.width/2+(b.x-a.x)*offset,a.y+a.height/2+(b.y-a.y)*offset,{steps:8});
  if(cancel)await page.keyboard.press('Escape');await page.mouse.up();await ready();
}
try{
  await page.goto(process.env.DITHER_URL||'http://127.0.0.1:4173/');await page.locator('#new-dialog [data-close]').click();await ready();await key('g');
  assert.equal(await stops().count(),2);assert.equal(await page.locator('#tool-options [data-setting=foreground]').count(),0);
  assert.equal(await page.locator('#tool-options strong').count(),0);assert.equal(await handles().count(),0);
  const initial=await count();
  await page.locator('[data-stop-order="0"] [data-tool-action=edit-stop]').click();
  await page.locator('[data-stop-order="0"] [data-stop=colour]').fill('#ff0000');
  await page.keyboard.press('Escape');await page.locator('[data-tool-action=add-stop]').click();
  assert.equal(await stops().count(),3);assert.equal(await count(),initial);
  const stage=await page.locator('#stage').boundingBox();
  await page.mouse.move(stage.x+stage.width*.2,stage.y+stage.height*.4);await page.mouse.down();await page.mouse.move(stage.x+stage.width*.8,stage.y+stage.height*.6,{steps:8});await page.mouse.up();await ready();
  assert.equal(await count(),initial+1);assert.equal(await handles().count(),1);
  assert.equal(await page.locator('[data-gradient-stop="0"], [data-gradient-stop="1"]').count(),0);
  assert.equal(await page.locator('[data-stop-order="0"] [data-tool-action=remove-stop], [data-stop-order="1"] [data-tool-action=remove-stop]').count(),0);
  const beforeNoop=await count();await handles().first().click();await ready();assert.equal(await count(),beforeNoop);
  await dragHandle(2,.75);assert.equal(await count(),beforeNoop+1);assert.equal(await handles().first().getAttribute('aria-valuenow'),'75');
  await key('Control+z');assert.equal(await handles().first().getAttribute('aria-valuenow'),'50');await key('Control+Shift+z');
  const beforeCancel=await count();await dragHandle(2,.3,true);assert.equal(await count(),beforeCancel);assert.equal(await handles().first().getAttribute('aria-valuenow'),'75');
  await handles().first().click();assert.equal(await page.evaluate(()=>document.activeElement.dataset.gradientStop),'2');await page.keyboard.press('ArrowLeft');await ready();assert.equal(await handles().first().getAttribute('aria-valuenow'),'74');
  await page.locator('[data-stop-order="2"] [data-tool-action=edit-stop]').click();
  const opacity=page.locator('[data-stop-order="2"] [data-stop=opacity]'),beforeColour=await count();
  await opacity.evaluate(el=>{el.value='.25';el.dispatchEvent(new Event('input',{bubbles:true}));el.value='.5';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
  await ready();assert.equal(await count(),beforeColour+1);await page.keyboard.press('Escape');
  for(let i=0;i<3;i++){await page.locator('[data-tool-action=add-stop]').click();await ready();}
  assert.equal(await stops().count(),6);assert.equal(await handles().count(),4);assert.ok(await page.locator('[data-tool-action=add-stop]').isDisabled());
  const orderBefore=await stops().evaluateAll(els=>els.map(el=>el.dataset.stopOrder));
  await dragHandle(2,.1);assert.equal(await page.locator('[data-gradient-stop="2"]').getAttribute('aria-valuenow'),'10');
  const orderAfter=await stops().evaluateAll(els=>els.map(el=>el.dataset.stopOrder));
  assert.notDeepEqual(orderAfter,orderBefore);assert.equal(orderAfter[0],'0');assert.equal(orderAfter[1],'2');assert.equal(orderAfter.at(-1),'1');
  assert.equal(await page.locator('[data-stop-order="2"] > span').textContent(),'Stop 2');
  assert.equal(await page.locator('[data-gradient-stop="2"]').getAttribute('aria-label'),'Stop 2 position');
  await key('Control+z');assert.deepEqual(await stops().evaluateAll(els=>els.map(el=>el.dataset.stopOrder)),orderBefore);
  await key('Control+Shift+z');assert.deepEqual(await stops().evaluateAll(els=>els.map(el=>el.dataset.stopOrder)),orderAfter);
  await dragHandle(2,.9,true);assert.deepEqual(await stops().evaluateAll(els=>els.map(el=>el.dataset.stopOrder)),orderAfter);
  await page.locator('[data-stop-order="3"] [data-tool-action=remove-stop]').click();await ready();assert.equal(await stops().count(),5);assert.ok(await page.locator('[data-tool-action=add-stop]').isEnabled());
  await key('Control+z');assert.equal(await stops().count(),6);
  await page.locator('[data-setting=gradientType]').selectOption('radial');await ready();await dragHandle(2,.6);assert.equal(await page.locator('[data-gradient-stop="2"]').getAttribute('aria-valuenow'),'60');
  for(const [path,value] of [['transform.width','800'],['transform.height','500'],['transform.rotation','37']]){await page.locator(`[data-path="${path}"]`).fill(value);await page.locator(`[data-path="${path}"]`).press('Tab');}
  await page.locator('[data-action=flip-x]').click();await ready();await dragHandle(2,.35);assert.equal(await page.locator('[data-gradient-stop="2"]').getAttribute('aria-valuenow'),'35');
  await page.locator('[data-path=locked]').check();await page.locator('[data-path=locked]').press('Tab');await ready();assert.equal(await handles().count(),0);assert.ok(await page.locator('[data-tool-action=add-stop]').isDisabled());
  await page.locator('[data-path=locked]').uncheck();await page.locator('[data-path=locked]').press('Tab');await ready();
  await key('Control+s');await page.getByRole('status').filter({hasText:'Project saved'}).waitFor();
  const saved=await page.evaluate(async()=>{const {listProjects,loadProject}=await import('./js/storage/projects.js');const {DocumentRenderer}=await import('./js/rendering/renderer.js');const {doc,assets}=await loadProject((await listProjects())[0].id);const renderer=new DocumentRenderer(),canvas=document.createElement('canvas');doc.layers[0].effects=[{id:'test',type:'blur',enabled:true,radius:2}];await renderer.renderDocument(doc,assets,canvas);const bitmap=await createImageBitmap(await renderer.exportPNG(doc,assets)),out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height;out.getContext('2d').drawImage(bitmap,0,0);const a=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,b=out.getContext('2d').getImageData(0,0,out.width,out.height).data;const result={stops:doc.layers[0].shape.gradient.stops,same:a.every((v,i)=>v===b[i])};assets.dispose();bitmap.close();return result;});
  assert.ok(saved.same);assert.equal(saved.stops.length,6);assert.equal(saved.stops.find(s=>s.order===0).offset,0);assert.equal(saved.stops.find(s=>s.order===1).offset,1);assert.equal(saved.stops.find(s=>s.order===2).opacity,.5);
  await page.locator('[data-stop-order="2"] [data-tool-action=edit-stop]').click();await mkdir('.test-results',{recursive:true});await page.screenshot({path:'.test-results/gradient-options.png'});
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:390,height:700});await ready();
  const options=await page.locator('#tool-options').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));assert.ok(options.scroll<=options.width+1);
  await page.locator('[data-stop-order="2"] [data-tool-action=edit-stop]').click();const popup=await page.locator('[popover]:popover-open').boundingBox();assert.ok(popup.x>=0&&popup.x+popup.width<=390);
  await page.screenshot({path:'.test-results/gradient-options-mobile.png'});
  assert.deepEqual(errors,[]);console.log('PASS gradient defaults, RGBA edits, endpoints, intermediate handles, keyboard, undo/cancel, six-stop limit, transforms and persistence/export');
}finally{await browser.close();}
