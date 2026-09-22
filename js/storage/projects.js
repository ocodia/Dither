import { clone, validateDocument } from '../model/document.js';
import { AssetStore } from './assets.js';
let database;
function openDatabase() {
  if (database) return database;
  database = new Promise((resolve, reject) => {
    const req = indexedDB.open('dither', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('projects', { keyPath: 'id' }); req.result.createObjectStore('assets', { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { database = null; reject(new Error('Local storage is unavailable. Check browser storage permissions.')); };
    req.onblocked = () => { database = null; reject(new Error('Close other Dither tabs to update local storage.')); };
  });
  return database;
}
const result = req => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
const completed = tx => new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error || new Error('Storage transaction failed.')); });
export async function saveProject(document, assets) {
  const doc = clone(document); validateDocument(doc); doc.modified = Date.now();
  const used = new Set(doc.layers.filter(l => l.type === 'image').map(l => l.assetId));
  doc.assets = doc.assets.filter(a => used.has(a.id));
  for (const id of used) if (!assets.blobs.has(id)) throw new Error('An original image is missing. The project was not saved.');
  const db = await openDatabase();
  try {
    const tx = db.transaction(['projects', 'assets'], 'readwrite'), done = completed(tx);
    try {
      tx.objectStore('projects').put(doc);
      for (const id of used) tx.objectStore('assets').put({ id, blob: assets.blobs.get(id) });
    } catch (error) { tx.abort(); await done.catch(() => {}); throw error; }
    await done;
  } catch (error) { throw new Error(error.name === 'QuotaExceededError' ? 'Browser storage is full. Free space and save again; your work is still open.' : 'Could not save locally. Your work is still open.'); }
}
export async function listProjects() { const db = await openDatabase(); return (await result(db.transaction('projects').objectStore('projects').getAll())).sort((a, b) => b.modified - a.modified); }
export async function loadProject(id) {
  const db = await openDatabase(), doc = await result(db.transaction('projects').objectStore('projects').get(id));
  validateDocument(doc);
  const tx = db.transaction('assets'), records = await Promise.all(doc.assets.map(a => result(tx.objectStore('assets').get(a.id))));
  const stored = new Map(records.filter(Boolean).map(a => [a.id, a.blob])), assets = new AssetStore();
  try { for (const meta of doc.assets) { if (!stored.has(meta.id)) throw new Error(`Missing original image: ${meta.name}.`); await assets.add(stored.get(meta.id), meta.id); } }
  catch (error) { assets.dispose(); throw error; }
  return { doc, assets };
}
