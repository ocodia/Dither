// Optional maintenance helper. The generated PNGs are already included in the app.
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.DITHER_PLAYWRIGHT_PATH ? pathToFileURL(resolve(process.env.DITHER_PLAYWRIGHT_PATH)).href : 'playwright');
const browser = await chromium.launch({ channel: process.env.DITHER_BROWSER || 'msedge', headless:true });
try {
  const page = await browser.newPage(); await page.goto((process.env.DITHER_URL || 'http://127.0.0.1:4173/') + 'icons/app-icon.svg');
  const icons = await page.evaluate(async () => {
    const img = new Image(); img.src = location.href; await img.decode(); const images = {};
    for (const size of [192,512]) { const c=document.createElementNS('http://www.w3.org/1999/xhtml','canvas');c.width=c.height=size;c.getContext('2d').drawImage(img,0,0,size,size);images[`app-${size}.png`]=c.toDataURL().split(',')[1]; }
    const c=document.createElementNS('http://www.w3.org/1999/xhtml','canvas');c.width=c.height=512;const ctx=c.getContext('2d');ctx.fillStyle='#0f172a';ctx.fillRect(0,0,512,512);ctx.drawImage(img,76,76,360,360);images['app-maskable-512.png']=c.toDataURL().split(',')[1];return images;
  });
  for (const [name,data] of Object.entries(icons)) await writeFile(resolve('icons',name),Buffer.from(data,'base64'));
} finally { await browser.close(); }
