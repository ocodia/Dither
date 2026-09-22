import { processPixels } from './pixels.js';
self.onmessage = ({ data: { id, buffer, width, height, effect } }) => {
  try { const data = processPixels(new Uint8ClampedArray(buffer), width, height, effect); self.postMessage({ id, buffer: data.buffer }, [data.buffer]); }
  catch (error) { self.postMessage({ id, error: error.message }); }
};
