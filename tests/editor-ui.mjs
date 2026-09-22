// Targeted real-browser coverage for history navigation and cursor-based creation.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.DITHER_PLAYWRIGHT_PATH ? pathToFileURL(resolve(process.env.DITHER_PLAYWRIGHT_PATH)).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.DITHER_BROWSER || 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width:1280, height:900 } }), errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('dialog', dialog => dialog.accept());
await mkdir('.test-results', { recursive:true });
try {
  await page.goto(process.env.DITHER_URL || 'http://127.0.0.1:4173/');
  await page.locator('#new-dialog [data-close]').click();
  assert.equal(await page.locator('.topbar,.statusbar,.tools [data-action=undo],.tools [data-action=redo]').count(),0);
  assert.equal(await page.locator('#workspace').evaluate(el => Math.round(el.getBoundingClientRect().height)),900);
  assert.ok(await page.locator('#properties [data-section=canvas] #project-name').isVisible());
  await page.locator('#project-name').fill('History test'); await page.locator('#project-name').press('Tab');
  // Each shortcut centres the new object at the pointer, using current viewport geometry.
  for (const [index,key] of ['r','t','e','l','a'].entries()) {
    await page.locator('#workspace').focus();
    const stage = await page.locator('#stage').boundingBox();
    const x = stage.x + stage.width * (.3 + index * .07), y = stage.y + stage.height * .4;
    await page.mouse.move(x,y); await page.keyboard.press(key);
    assert.ok(Math.abs(Number(await page.locator('[data-path="transform.x"]').inputValue()) - 1600 * (.3 + index * .07)) < .1);
    assert.ok(Math.abs(Number(await page.locator('[data-path="transform.y"]').inputValue()) - 400) < .1);
    // Zoom about the pointer before the next insertion; pointer coordinates must be remapped.
    await page.mouse.wheel(0,80);
  }
  assert.equal(await page.locator('#layer-count').textContent(),'5');
  await page.locator('[data-tab=history]').click();
  const states = await page.locator('[data-history-state]').evaluateAll(buttons => buttons.map(button => button.dataset.historyState));
  assert.equal(states.length,7);
  await page.locator(`[data-history-state="${states[1]}"]`).click(); assert.equal(await page.locator('#layer-count').textContent(),'0');
  await page.locator('[data-history-state][aria-current]').press('ArrowDown'); assert.equal(await page.locator('#layer-count').textContent(),'1');
  await page.locator('[data-history-state][aria-current]').press('End'); assert.equal(await page.locator('#layer-count').textContent(),'5');
  await page.locator(`[data-history-state="${states[2]}"]`).click();
  await page.locator('[data-action=line]').click(); await page.locator('[data-tab=history]').click();
  assert.equal(await page.locator('[data-history-state]').count(),4);assert.equal(await page.locator(`[data-history-state="${states.at(-1)}"]`).count(),0);
  assert.ok(await page.locator('[data-action=redo]').isDisabled());
  await page.locator('[data-action=undo]').click();assert.equal(await page.locator('#layer-count').textContent(),'1');
  await page.locator('[data-action=redo]').click();assert.equal(await page.locator('#layer-count').textContent(),'2');
  await page.locator('#workspace').focus();await page.keyboard.press('Control+s');
  await page.getByRole('status').filter({hasText:'Project saved on this device.'}).waitFor();
  const toast = await page.locator('#toast').boundingBox(), workspace = await page.locator('#workspace').boundingBox();
  assert.ok(Math.abs(workspace.x + workspace.width - toast.x - toast.width - 16) < 1);
  assert.ok(Math.abs(workspace.y + workspace.height - toast.y - toast.height - 16) < 1);
  assert.equal(await page.locator('.history-entry[aria-current] small').textContent(),'Saved');
  await page.screenshot({path:'.test-results/history-workspace.png'});
  await page.locator('.document-menu-toggle').click();await page.locator('#document-menu [data-action=open]').click();
  assert.equal(await page.locator('#open-title').textContent(),'Open document');assert.equal(await page.locator('#open-dialog .dialog-brand').count(),0);
  await page.locator('#open-dialog').screenshot({path:'.test-results/open-document-clean.png'});
  await page.locator('[data-project]').click();await page.getByRole('status').filter({hasText:'Project opened.'}).waitFor();
  await page.locator('[data-tab=history]').click();assert.equal(await page.locator('[data-history-state]').count(),1);
  await page.locator('[data-action=canvas]').click();assert.equal(await page.locator('#project-name').inputValue(),'History test');
  await page.setViewportSize({width:600,height:820});
  assert.equal(await page.locator('#inspector').evaluate(el=>Math.round(el.getBoundingClientRect().height)),820);
  await page.locator('[data-action=panels]').click();assert.ok(!(await page.locator('#inspector').isVisible()));
  await page.locator('.document-menu-toggle').click();assert.ok(await page.locator('#document-menu [data-action=export]').isVisible());
  assert.deepEqual(errors,[]);
  console.log('PASS history jumps/keyboard/branching/reset, cursor creation at changing zoom, name/save, workspace toasts, dialogs and mobile controls.');
} catch (error) { await page.screenshot({path:'.test-results/editor-ui-failure.png'}); throw error; }
finally { await browser.close(); }
