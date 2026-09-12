const DB = 'mkwii-saves';
const STORE = 'nand';
const KEY = 'nand-v1';
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function loadSaveState(worker) {
  const db = await openDb();
  const blob = await new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).get(KEY);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => resolve(null);
  });
  if (!blob || !blob.files || !blob.files.length) return false;
  worker.postMessage({ type: 'save-restore', id: 'boot', files: blob.files });
  return true;
}
export async function persistSaveState(worker) {
  const id = crypto.randomUUID();
  const files = await new Promise((resolve) => {
    const h = (e) => {
      if (e.data.type === 'save-snapshot' && e.data.id === id) {
        worker.removeEventListener('message', h);
        resolve(e.data.files);
      }
    };
    worker.addEventListener('message', h);
    worker.postMessage({ type: 'save-snapshot', id });
  });
  if (!files || !files.length) return;
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ files, savedAt: Date.now() }, KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
export function scheduleAutoSave(worker, intervalMs = 15000) {
  let running = true;
  const tick = async () => {
    if (!running) return;
    try { await persistSaveState(worker); } catch (e) { console.warn('[save] auto', e); }
    setTimeout(tick, intervalMs);
  };
  setTimeout(tick, intervalMs);
  return () => { running = false; };
}
export async function clearSaveState() {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}