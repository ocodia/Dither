import { isLineLayer, arrowMetrics } from '../model/line.js';

export const rad = degrees => degrees * Math.PI / 180;
export function rotate(point, degrees) {
  const c = Math.cos(rad(degrees)), s = Math.sin(rad(degrees));
  return { x: point.x * c - point.y * s, y: point.x * s + point.y * c };
}
export function localToWorld(point, t) {
  const p = rotate({ x: point.x * (t.flipX ? -1 : 1), y: point.y * (t.flipY ? -1 : 1) }, t.rotation);
  return { x: t.x + p.x, y: t.y + p.y };
}
export function worldToLocal(point, t) {
  const p = rotate({ x: point.x - t.x, y: point.y - t.y }, -t.rotation);
  return { x: p.x * (t.flipX ? -1 : 1), y: p.y * (t.flipY ? -1 : 1) };
}
export function lineEndpoints(t) {
  return [localToWorld({ x: -t.width / 2, y: t.height / 2 }, t), localToWorld({ x: t.width / 2, y: -t.height / 2 }, t)];
}
export function moveLineEndpoint(t, index, point, { shift = false } = {}) {
  const endpoints = lineEndpoints(t), fixed = endpoints[1 - index], moving = endpoints[index];
  const originalLength = Math.hypot(t.width, t.height), dx = point.x - fixed.x, dy = point.y - fixed.y;
  const originalAngle = Math.atan2(moving.y - fixed.y, moving.x - fixed.x);
  let angle = Math.hypot(dx, dy) < 1e-8 ? originalAngle : Math.atan2(dy, dx);
  if (shift) angle = Math.round(angle / (Math.PI / 12)) * Math.PI / 12;
  // Keep the existing local diagonal and flip flags, rotating/scaling it onto the new segment.
  // This preserves old projects and avoids zero-sized buffers for horizontal/vertical lines.
  const scale = Math.max(1 / t.width, 1 / t.height, Math.min(Math.hypot(dx, dy) / originalLength, 8192 / t.width, 8192 / t.height, Math.sqrt(32_000_000 / (t.width * t.height))));
  const length = originalLength * scale, end = { x: fixed.x + Math.cos(angle) * length, y: fixed.y + Math.sin(angle) * length };
  return { ...t, x: (fixed.x + end.x) / 2, y: (fixed.y + end.y) / 2, width: t.width * scale, height: t.height * scale, rotation: ((t.rotation + (angle - originalAngle) * 180 / Math.PI) % 360 + 360) % 360 };
}
export function hitTest(layers, point, tolerance = 6, includeLocked = false) {
  return [...layers].reverse().find(layer => {
    if (!layer.visible || (layer.locked && !includeLocked)) return false;
    const p = worldToLocal(point, layer.transform);
    if (isLineLayer(layer)) {
      const { width: w, height: h } = layer.transform, length = Math.hypot(w, h);
      const dx = p.x + w / 2, dy = p.y - h / 2;
      const along = (dx * w - dy * h) / length, across = Math.abs((dx * h + dy * w) / length);
      const s = layer.shape, m = arrowMetrics(s, length);
      if (!s.strokeWidth || !s.strokeOpacity) return false;
      const start = m.start ? m.depth : 0, end = m.end ? length - m.depth : length;
      const nearest = Math.max(start, Math.min(end, along));
      if (Math.hypot(along - nearest, across) <= m.half + tolerance) return true;
      const headHit = distance => distance >= -tolerance && distance <= m.depth + tolerance && across <= Math.max(0, distance) / m.depth * m.headHalf + tolerance;
      return (m.start && headHit(along)) || (m.end && headHit(length - along));
    }
    return Math.abs(p.x) <= layer.transform.width / 2 && Math.abs(p.y) <= layer.transform.height / 2;
  }) || null;
}
// Resize in the unflipped bounding-box axes; the opposite handle remains fixed.
export function resizeTransform(t, handle, delta, { shift = false, alt = false } = {}) {
  const [hx, hy] = handle, d = rotate(delta, -t.rotation), factor = alt ? 2 : 1;
  let width = hx ? Math.max(1, Math.min(8192, t.width + d.x * hx * factor)) : t.width;
  let height = hy ? Math.max(1, Math.min(8192, t.height + d.y * hy * factor)) : t.height;
  if (shift) {
    const scale = !hx ? height / t.height : !hy ? width / t.width : Math.abs(width / t.width - 1) > Math.abs(height / t.height - 1) ? width / t.width : height / t.height;
    const bounded = Math.min(scale, 8192 / t.width, 8192 / t.height);
    width = Math.max(1, t.width * bounded); height = Math.max(1, t.height * bounded);
  }
  if (width * height > 32_000_000) { const scale = Math.sqrt(32_000_000 / (width * height)); width *= scale; height *= scale; }
  const offset = alt ? { x: 0, y: 0 } : rotate({ x: hx * (width - t.width) / 2, y: hy * (height - t.height) / 2 }, t.rotation);
  return { ...t, width, height, x: t.x + offset.x, y: t.y + offset.y };
}
