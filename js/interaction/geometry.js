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
export function hitTest(layers, point) {
  return [...layers].reverse().find(layer => {
    if (!layer.visible || layer.locked) return false;
    const p = worldToLocal(point, layer.transform);
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
