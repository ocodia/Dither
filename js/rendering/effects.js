import { processPixels } from './pixels.js';
let worker, counter = 0;
const pending = new Map();
function getWorker() {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./pixel-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => { const task = pending.get(data.id); if (!task) return; pending.delete(data.id); data.error ? task.reject(new Error(data.error)) : task.resolve(new Uint8ClampedArray(data.buffer)); };
    worker.onerror = () => { for (const task of pending.values()) task.reject(new Error('Image processing failed. Try a smaller layer.')); pending.clear(); worker.terminate(); worker = null; };
  } catch { worker = null; }
  return worker;
}
export function surface(width, height) {
  const canvas = document.createElement('canvas'); canvas.width = Math.ceil(width); canvas.height = Math.ceil(height);
  if (canvas.width * canvas.height > 40_000_000) throw new Error('The layer and its effects exceed the 40-megapixel render limit. Reduce the layer size or effect radius.');
  return canvas;
}
export function effectPadding(layer) {
  let padding = layer.shape ? Math.ceil(layer.shape.strokeWidth / 2 + 2) : 2;
  if (layer.shape?.kind === 'path') {
    const {width,height}=layer.transform;
    for(const a of layer.shape.anchors) for(const p of [a,a.in,a.out]) padding=Math.max(padding, Math.ceil(Math.max(-p.x*width,(p.x-1)*width,-p.y*height,(p.y-1)*height)+layer.shape.strokeWidth/2+2));
  }
  if (layer.shape?.kind === 'arrow') padding += Math.ceil(layer.shape.arrowSize / 2);
  for (const e of layer.effects.filter(e => e.enabled)) {
    if (e.type === 'stroke') padding += e.width;
    if (e.type === 'blur') padding += e.radius * 3;
    if (e.type === 'drop-shadow') padding += Math.max(Math.abs(e.offsetX), Math.abs(e.offsetY)) + e.blur * 3;
  }
  return Math.ceil(padding);
}
async function pixelEffect(canvas, effect) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true }), { width, height } = canvas;
  const pixels = ctx.getImageData(0, 0, width, height), processor = getWorker();
  const data = processor ? await new Promise((resolve, reject) => {
    const id = counter++; pending.set(id, { resolve, reject }); processor.postMessage({ id, buffer: pixels.data.buffer, width, height, effect }, [pixels.data.buffer]);
  }) : processPixels(pixels.data, width, height, effect);
  ctx.putImageData(new ImageData(data, width, height), 0, 0); return canvas;
}
export const effectRegistry = {
  brightness: pixelEffect, contrast: pixelEffect, dither: pixelEffect, stroke: pixelEffect,
  'colour-overlay': async (canvas, e) => {
    // Interpolate colour without adding opacity to partially transparent source pixels.
    const original = canvas.getContext('2d'); original.globalCompositeOperation = 'source-atop'; original.globalAlpha = e.opacity; original.fillStyle = e.colour; original.fillRect(0, 0, canvas.width, canvas.height); original.globalAlpha = 1; original.globalCompositeOperation = 'source-over';
    return canvas;
  },
  blur: async (canvas, e) => { const out = surface(canvas.width, canvas.height), ctx = out.getContext('2d'); ctx.filter = `blur(${e.radius}px)`; ctx.drawImage(canvas, 0, 0); return out; },
  'drop-shadow': async (canvas, e) => {
    const shadow = surface(canvas.width, canvas.height), s = shadow.getContext('2d');
    s.drawImage(canvas, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = e.colour; s.fillRect(0, 0, shadow.width, shadow.height);
    const out = surface(canvas.width, canvas.height), ctx = out.getContext('2d');
    ctx.globalAlpha = e.opacity; ctx.filter = `blur(${e.blur}px)`; ctx.drawImage(shadow, e.offsetX, e.offsetY); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.drawImage(canvas, 0, 0); return out;
  }
};
export async function applyEffects(canvas, effects) {
  for (const effect of effects) if (effect.enabled) {
    const apply = effectRegistry[effect.type]; if (!apply) throw new Error(`Unsupported effect: ${effect.type}`);
    canvas = await apply(canvas, effect);
  }
  return canvas;
}
