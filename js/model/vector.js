export const isPath = layer => layer?.shape?.kind === 'path';
export const canGradient = layer => layer?.type === 'shape' && (['rectangle', 'ellipse'].includes(layer.shape.kind) || isPath(layer) && layer.shape.closed);
const pointValid = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x) <= 100000 && Math.abs(p.y) <= 100000;
export function validPath(shape) {
  return typeof shape.closed === 'boolean' && Array.isArray(shape.anchors) && shape.anchors.length >= 2 && shape.anchors.length <= 4096 && shape.anchors.every(a => pointValid(a) && pointValid(a.in) && pointValid(a.out));
}
export function validGradient(g) {
  return g && validStopOrders(g.stops) && (g.solidFillOpacity === undefined || Number.isFinite(g.solidFillOpacity) && g.solidFillOpacity >= 0 && g.solidFillOpacity <= 1) && ['linear', 'radial'].includes(g.type) && pointValid(g.start) && pointValid(g.end) && Math.hypot(g.end.x-g.start.x,g.end.y-g.start.y)>1e-8 && Array.isArray(g.stops) && g.stops.length >= 2 && g.stops.length <= 34 && g.stops.every((s,i) => /^#[\da-f]{6}$/i.test(s.colour) && Number.isFinite(s.opacity) && s.opacity >= 0 && s.opacity <= 1 && Number.isFinite(s.offset) && s.offset >= 0 && s.offset <= 1 && (!i || s.offset >= g.stops[i-1].offset));
}
export function tracePath(ctx, shape, width, height) {
  const a = shape.anchors; ctx.moveTo(a[0].x*width,a[0].y*height);
  for(let i=1;i<a.length+(shape.closed?1:0);i++) {
    const p=a[i-1], q=a[i%a.length];
    ctx.bezierCurveTo(p.out.x*width,p.out.y*height,q.in.x*width,q.in.y*height,q.x*width,q.y*height);
  }
  if(shape.closed)ctx.closePath();
}
export function gradientStyle(ctx, g, width, height) {
  const x=g.start.x*width,y=g.start.y*height,ex=g.end.x*width,ey=g.end.y*height;
  const fill=g.type==='radial'?ctx.createRadialGradient(x,y,0,x,y,Math.max(.0001,Math.hypot(ex-x,ey-y))):ctx.createLinearGradient(x,y,ex,ey);
  for(const s of g.stops)fill.addColorStop(s.offset,`${s.colour}${Math.round(s.opacity*255).toString(16).padStart(2,'0')}`);
  return fill;
}
// Include control points in the bounds: the cubic is inside their convex hull.
export function pathBounds(anchors) {
  const points=anchors.flatMap(a=>[a,a.in,a.out]);
  const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
  return {x,y,width:Math.max(1,Math.max(...points.map(p=>p.x))-x),height:Math.max(1,Math.max(...points.map(p=>p.y))-y)};
}

// `order` is a stable editing identity; rendering keeps stops sorted by offset.
function validStopOrders(stops) {
  if (!Array.isArray(stops)) return false;
  if (stops.every(s => s.order === undefined)) return true;
  return stops.every(s => Number.isSafeInteger(s.order) && s.order >= 0) &&
    new Set(stops.map(s => s.order)).size === stops.length &&
    stops.some(s => s.order === 0 && s.offset === 0) && stops.some(s => s.order === 1 && s.offset === 1);
}
export function editableStops(stops) {
  const result = structuredClone(stops);
  if (result.every(s => s.order !== undefined)) return result;
  if (result[0].offset !== 0) result.unshift({...result[0], offset:0});
  if (result.at(-1).offset !== 1) result.push({...result.at(-1), offset:1});
  result.forEach((s,i) => s.order = i === 0 ? 0 : i === result.length-1 ? 1 : i+1);
  return result;
}
export function addGradientStop(stops) {
  if (stops.length >= 6) return null;
  let index=0;
  for (let i=1;i<stops.length-1;i++) if (stops[i+1].offset-stops[i].offset > stops[index+1].offset-stops[index].offset) index=i;
  const a=stops[index], b=stops[index+1], opacity=(a.opacity+b.opacity)/2;
  // Match Canvas gradient interpolation: colour and alpha interpolate separately.
  const colour='#'+[1,3,5].map(i => {
    const value=(parseInt(a.colour.slice(i,i+2),16)+parseInt(b.colour.slice(i,i+2),16))/2;
    return Math.round(value).toString(16).padStart(2,'0');
  }).join('');
  const stop={offset:(a.offset+b.offset)/2,colour,opacity,order:Math.max(...stops.map(s=>s.order))+1};
  stops.push(stop);stops.sort((a,b)=>a.offset-b.offset);return stop;
}
export function gradientOffset(point, gradient, transform) {
  const dx=(gradient.end.x-gradient.start.x)*transform.width, dy=(gradient.end.y-gradient.start.y)*transform.height;
  const x=(point.x-gradient.start.x)*transform.width, y=(point.y-gradient.start.y)*transform.height;
  const length=dx*dx+dy*dy;
  return length ? Math.max(0,Math.min(1,(x*dx+y*dy)/length)) : 0;
}
