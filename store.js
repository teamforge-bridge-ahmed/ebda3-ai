// Local-first storage: IndexedDB for projects/images, localStorage for settings.
const DB = 'ebda3', VER = 1;
let dbp;
function db() {
  return dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('gallery')) d.createObjectStore('gallery', { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}
export const projects = {
  put: (p) => { p.updated = Date.now(); return tx('projects', 'readwrite', s => s.put(p)); },
  get: (id) => tx('projects', 'readonly', s => s.get(id)),
  all: () => tx('projects', 'readonly', s => s.getAll()),
  del: (id) => tx('projects', 'readwrite', s => s.delete(id)),
};
export const gallery = {
  put: (g) => tx('gallery', 'readwrite', s => s.put(g)),
  all: () => tx('gallery', 'readonly', s => s.getAll()),
  del: (id) => tx('gallery', 'readwrite', s => s.delete(id)),
};
export const settings = {
  get(k, d) { try { const v = localStorage.getItem('ebda3.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { localStorage.setItem('ebda3.' + k, JSON.stringify(v)); },
};
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
