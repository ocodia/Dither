export const isLineLayer = layer => layer.type === 'shape' && ['line', 'arrow'].includes(layer.shape.kind);

export function arrowMetrics(shape, length) {
  const start = shape.kind === 'arrow' && shape.startArrow;
  const end = shape.kind === 'arrow' && shape.endArrow;
  const depth = Math.min(shape.arrowSize, length / (start && end ? 2 : 1));
  return { start, end, depth, half: shape.strokeWidth / 2, headHalf: Math.max(depth / 2, shape.strokeWidth / 2) };
}
