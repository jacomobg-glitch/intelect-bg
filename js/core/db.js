// Тънка обвивка над IndexedDB с обещания.
const DB_NAME = 'evolyutsiya-na-uma';
const DB_VERSION = 1;
export const STORES = ['meta', 'records', 'topics'];
const KEY_PATHS = { meta: 'key', records: 'id', topics: 'id' };

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const name of STORES) {
        if (!req.result.objectStoreNames.contains(name)) {
          req.result.createObjectStore(name, { keyPath: KEY_PATHS[name] });
        }
      }
    };
    req.onsuccess = () => {
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

const asPromise = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const done = (tx) => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onabort = () => reject(tx.error);
  tx.onerror = () => reject(tx.error);
});

export async function getOne(store, key) {
  const db = await openDB();
  return asPromise(db.transaction(store).objectStore(store).get(key));
}

export async function getAll(store) {
  const db = await openDB();
  return asPromise(db.transaction(store).objectStore(store).getAll());
}

// writes: [{ store, value }] или [{ store, delete: key }]. Всичко е една атомарна транзакция.
export async function writeAll(writes) {
  const db = await openDB();
  const names = [...new Set(writes.map((w) => w.store))];
  const tx = db.transaction(names, 'readwrite');
  for (const w of writes) {
    if ('delete' in w) tx.objectStore(w.store).delete(w.delete);
    else tx.objectStore(w.store).put(w.value);
  }
  return done(tx);
}

// Пълна замяна на данните при импорт: или минава цялата, или нищо не се променя.
export async function replaceEverything(byStore) {
  const db = await openDB();
  const tx = db.transaction(STORES, 'readwrite');
  for (const name of STORES) {
    const os = tx.objectStore(name);
    os.clear();
    for (const value of byStore[name] || []) os.put(value);
  }
  return done(tx);
}
