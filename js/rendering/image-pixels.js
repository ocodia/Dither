import { traceRegion, regionBounds } from '../model/pixel-region.js';
import { surface } from './effects.js';

export function applyErasures(ctx, regions, width, height) {
  if (!regions?.length) return;
  ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000';
  for (const points of regions) { traceRegion(ctx, points, width, height); ctx.fill('evenodd'); }
  ctx.restore();
}
async function signature(canvas) {
  const data = canvas.getContext('2d', {willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height).data;
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function extractSelection(layer, image, points) {
  const crop = regionBounds(points, image.width, image.height);
  if (!crop.width || !crop.height) throw new Error('The selection does not overlap this image.');
  const canvas = surface(crop.width,crop.height), ctx = canvas.getContext('2d',{willReadFrequently:true});
  ctx.translate(-crop.x,-crop.y); ctx.drawImage(image,0,0); applyErasures(ctx,layer.eraseRegions,image.width,image.height); ctx.setTransform(1,0,0,1,0,0);
  const mask = surface(crop.width,crop.height), m = mask.getContext('2d'); m.translate(-crop.x,-crop.y); traceRegion(m,points,image.width,image.height); m.fill('evenodd');
  ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0);ctx.globalCompositeOperation='source-over';
  const pixels = ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let opaque=false;for(let i=3;i<pixels.length;i+=4)if(pixels[i]){opaque=true;break;}
  if (!opaque) throw new Error('The selection contains no visible image pixels.');
  const [blob, hash] = await Promise.all([new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not copy the selected pixels.')),'image/png')),signature(canvas)]);
  return {blob,hash,crop,sourceWidth:image.width,sourceHeight:image.height};
}
export async function matchesClipboard(blob, clipboard) {
  let image;
  try {
    image=await createImageBitmap(blob);
    if(image.width!==clipboard.crop.width||image.height!==clipboard.crop.height)return false;
    const canvas=surface(image.width,image.height);canvas.getContext('2d').drawImage(image,0,0);
    return await signature(canvas)===clipboard.hash;
  } catch { return false; } finally { image?.close(); }
}
