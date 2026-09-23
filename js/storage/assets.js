import { uid } from '../model/document.js';
export class AssetStore {
  constructor() { this.blobs = new Map(); this.images = new Map(); this.disposed = false; }
  async add(blob, id = uid()) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type)) throw new Error('Import a PNG, JPEG, or WebP image.');
    let image;
    try { image = await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
    catch { throw new Error('This image could not be decoded. It may be damaged.'); }
    if (this.disposed) { image.close(); throw new Error('The document was closed before import finished.'); }
    if (image.width * image.height > 80_000_000) { image.close(); throw new Error('This image is too large. Import an image below 80 megapixels.'); }
    this.blobs.set(id, blob); this.images.set(id, image);
    return { id, name: blob.name || 'Image', mime: blob.type, width: image.width, height: image.height };
  }
  remove(id) { this.images.get(id)?.close?.(); this.images.delete(id); this.blobs.delete(id); }
  collect(document, history) {
    const used = new Set(document.layers.map(layer => layer.assetId).filter(Boolean));
    for (const command of [...history.undoStack, ...history.redoStack]) for (const id of command.assetIds || []) used.add(id);
    for (const id of this.blobs.keys()) if (!used.has(id)) this.remove(id);
    document.assets = document.assets.filter(asset => used.has(asset.id));
  }
  dispose() { this.disposed = true; for (const image of this.images.values()) image.close(); this.images.clear(); this.blobs.clear(); }
}
