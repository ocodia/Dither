import { floodFill } from './flood-fill.js';
self.onmessage=({data:m})=>{try{const data=floodFill(new Uint8ClampedArray(m.buffer),m.width,m.height,m.x,m.y,m.colour,m.opacity,m.tolerance,m.mask?new Uint8ClampedArray(m.mask):null);self.postMessage({buffer:data.buffer},[data.buffer]);}catch(error){self.postMessage({error:error.message});}};
