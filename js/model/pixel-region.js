export const selectionTools = ['marquee-rect', 'marquee-ellipse', 'lasso', 'polygon-lasso'];
export const isSelectionTool = tool => selectionTools.includes(tool);
export function regionPath(points, width = 1, height = 1) {
  return points.length ? `M${points.map(p => `${p.x * width},${p.y * height}`).join('L')}Z` : '';
}
export function traceRegion(ctx, points, width, height) {
  ctx.beginPath(); points.forEach((point, index) => ctx[index ? 'lineTo' : 'moveTo'](point.x * width, point.y * height)); ctx.closePath();
}
export function regionBounds(points, width, height) {
  // Inverse transforms can put an exact pixel edge a few ulps either side of an integer.
  const snap = value => Math.abs(value - Math.round(value)) < 1e-7 ? Math.round(value) : value;
  const left = Math.max(0, Math.floor(snap(Math.min(...points.map(p => p.x)) * width)));
  const top = Math.max(0, Math.floor(snap(Math.min(...points.map(p => p.y)) * height)));
  const right = Math.min(width, Math.ceil(snap(Math.max(...points.map(p => p.x)) * width)));
  const bottom = Math.min(height, Math.ceil(snap(Math.max(...points.map(p => p.y)) * height)));
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}
export function marqueePoints(start, end, ellipse = false) {
  const left = Math.min(start.x, end.x), top = Math.min(start.y, end.y), width = Math.abs(end.x - start.x), height = Math.abs(end.y - start.y);
  if (!ellipse) return [{x:left,y:top},{x:left+width,y:top},{x:left+width,y:top+height},{x:left,y:top+height}];
  return Array.from({length:128}, (_, i) => { const angle = i * Math.PI / 64; return { x: left + width / 2 * (1 + Math.cos(angle)), y: top + height / 2 * (1 + Math.sin(angle)) }; });
}
export function validRegion(points) {
  return Array.isArray(points) && points.length >= 3 && points.length <= 4096 && points.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) <= 1e6 && Math.abs(p.y) <= 1e6);
}
