import { applyEffects, effectPadding, surface } from './effects.js';
import { rad, localToWorld } from '../interaction/geometry.js';
import { checkSize } from '../model/document.js';
import { isLineLayer, arrowMetrics } from '../model/line.js';
import { applyErasures } from './image-pixels.js';

export function textLines(ctx, text, width, spacing) {
  const measure = str => ctx.measureText(str).width + Math.max(0, [...str].length - 1) * spacing;
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/(\s+)/)) {
      if (line && measure(line + word) > width) { lines.push(line.trimEnd()); line = ''; }
      if (!line && !word.trim()) continue;
      for (const char of word) { if (line && measure(line + char) > width) { lines.push(line); line = ''; } line += char; }
    }
    lines.push(line);
  }
  return lines;
}
const textFont = text => `${text.fontStyle} ${text.fontWeight} ${text.fontSize}px ${JSON.stringify(text.fontFamily === 'Noto' ? 'Noto Sans' : text.fontFamily)}, Inter, sans-serif`;
function drawText(ctx, layer) {
  const t = layer.text, { width, height } = layer.transform;
  ctx.font = textFont(t);
  ctx.fillStyle = t.colour; ctx.textBaseline = 'top';
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.clip();
  const lines = textLines(ctx, t.content, width, t.letterSpacing);
  lines.forEach((line, index) => {
    const chars = [...line], lineWidth = ctx.measureText(line).width + Math.max(0, chars.length - 1) * t.letterSpacing;
    let x = t.align === 'center' ? (width - lineWidth) / 2 : t.align === 'right' ? width - lineWidth : 0;
    const y = index * t.fontSize * t.lineHeight;
    if (t.letterSpacing === 0) ctx.fillText(line, x, y);
    else for (const char of chars) { ctx.fillText(char, x, y); x += ctx.measureText(char).width + t.letterSpacing; }
  });
  ctx.restore();
}
function drawShape(ctx, layer) {
  const s = layer.shape, { width: w, height: h } = layer.transform;
  if (isLineLayer(layer)) {
    if (!s.strokeWidth) return;
    const length = Math.hypot(w, h), { start, end, depth, half, headHalf } = arrowMetrics(s, length);
    // One filled silhouette joins the shaft to each head's base. A rounded shaft
    // must never run through the triangle and protrude beyond its tip.
    ctx.save(); ctx.translate(0, h); ctx.rotate(Math.atan2(-h, w));
    ctx.fillStyle = s.stroke; ctx.globalAlpha = s.strokeOpacity; ctx.beginPath();
    if (start) { ctx.moveTo(0, 0); ctx.lineTo(depth, -headHalf); ctx.lineTo(depth, -half); }
    else ctx.moveTo(0, -half);
    ctx.lineTo(end ? length - depth : length, -half);
    if (end) { ctx.lineTo(length - depth, -headHalf); ctx.lineTo(length, 0); ctx.lineTo(length - depth, headHalf); ctx.lineTo(length - depth, half); }
    else ctx.arc(length, 0, half, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(start ? depth : 0, half);
    if (start) { ctx.lineTo(depth, headHalf); ctx.lineTo(0, 0); }
    else ctx.arc(0, 0, half, Math.PI / 2, Math.PI * 1.5);
    ctx.closePath(); ctx.fill(); ctx.restore(); return;
  }
  ctx.lineWidth = s.strokeWidth; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.fillStyle = s.fill; ctx.strokeStyle = s.stroke;
  ctx.beginPath();
  if (s.kind === 'rectangle') ctx.roundRect(0, 0, w, h, Math.min(s.radius, w / 2, h / 2));
  if (s.kind === 'ellipse') ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.globalAlpha = s.fillOpacity; ctx.fill();
  ctx.globalAlpha = s.strokeOpacity; if (s.strokeWidth) ctx.stroke();
  ctx.globalAlpha = 1;
}
export class DocumentRenderer {
  constructor() { this.cache = new Map(); }
  clear() { this.cache.clear(); }
  async renderLayer(layer, assets) {
    const { width, height } = layer.transform;
    const key = JSON.stringify([layer.type, layer.assetId, layer.eraseRegions, layer.text, layer.shape, width, height, layer.effects]);
    if (this.cache.get(layer.id)?.key === key) return this.cache.get(layer.id).promise;
    const promise = (async () => {
      const padding = effectPadding(layer), canvas = surface(width + padding * 2, height + padding * 2), ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.translate(padding, padding);
      if (layer.type === 'image') { const image = assets.images.get(layer.assetId); if (!image) throw new Error(`Missing original image for ${layer.name}.`); ctx.drawImage(image, 0, 0, width, height); }
      if (layer.type === 'image') applyErasures(ctx, layer.eraseRegions, width, height);
      if (layer.type === 'text') {
        // Canvas does not wait for web fonts: load before measuring, drawing or caching.
        await document.fonts.load(textFont(layer.text), layer.text.content || ' ');
        drawText(ctx, layer);
      }
      if (layer.type === 'shape') drawShape(ctx, layer);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      return { canvas: await applyEffects(canvas, layer.effects), padding };
    })();
    this.cache.set(layer.id, { key, promise });
    try { return await promise; } catch (error) { if (this.cache.get(layer.id)?.key === key) this.cache.delete(layer.id); throw error; }
  }
  async renderDocument(doc, assets, target) {
    const ids = new Set(doc.layers.map(l => l.id)); for (const id of this.cache.keys()) if (!ids.has(id)) this.cache.delete(id);
    const rendered = [];
    for (const layer of doc.layers) if (layer.visible) rendered.push({ layer, rendered: await this.renderLayer(layer, assets) });
    if (target.width !== doc.canvas.width) target.width = doc.canvas.width;
    if (target.height !== doc.canvas.height) target.height = doc.canvas.height;
    const ctx = target.getContext('2d'); ctx.clearRect(0, 0, target.width, target.height);
    if (doc.canvas.background) { ctx.fillStyle = doc.canvas.background; ctx.fillRect(0, 0, target.width, target.height); }
    for (const { layer, rendered: { canvas, padding } } of rendered) {
      const t = layer.transform; ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(rad(t.rotation)); ctx.scale(t.flipX ? -1 : 1, t.flipY ? -1 : 1); ctx.globalAlpha = layer.opacity;
      ctx.drawImage(canvas, -t.width / 2 - padding, -t.height / 2 - padding); ctx.restore();
    }
  }
  async rasteriseLayer(layer, assets) {
    if (!['shape', 'text'].includes(layer.type)) throw new Error('Select a text, shape, line or arrow layer to rasterise.');
    const { canvas, padding } = await this.renderLayer(layer, assets);
    checkSize(canvas.width, canvas.height);
    const t = layer.transform;
    // Include strokes/effects and compensate for rounding fractional dimensions.
    const centre = localToWorld({ x: (canvas.width - t.width) / 2 - padding, y: (canvas.height - t.height) / 2 - padding }, t);
    const blob = await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not rasterise this layer. Try a smaller size.')), 'image/png'));
    return { blob, transform: { ...t, ...centre, width: canvas.width, height: canvas.height } };
  }
  async exportPNG(doc, assets) {
    const canvas = surface(doc.canvas.width, doc.canvas.height); await this.renderDocument(doc, assets, canvas);
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG export failed. Try a smaller document.')), 'image/png'));
  }
}
