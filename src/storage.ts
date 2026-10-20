// IndexedDB for the large catalogue (localStorage's ~5 MB quota is too tight for 2.6k records + edits).
const DB = 'tuuza-pharmacy', STORE = 'kv'
let dbp: Promise<IDBDatabase> | null = null
const open = () => (dbp ??= new Promise<IDBDatabase>((res, rej) => {
  if (typeof indexedDB === 'undefined') return rej(new Error('IndexedDB unavailable'))
  const r = indexedDB.open(DB, 1)
  r.onupgradeneeded = () => { r.result.createObjectStore(STORE) }
  r.onsuccess = () => res(r.result)
  r.onerror = () => { dbp = null; rej(r.error) }
}))
export async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await open()
    return await new Promise<T | undefined>((res, rej) => {
      const q = db.transaction(STORE).objectStore(STORE).get(key)
      q.onsuccess = () => res(q.result as T | undefined)
      q.onerror = () => rej(q.error)
    })
  } catch { return undefined }
}
export async function idbSet(key: string, val: unknown): Promise<boolean> {
  try {
    const db = await open()
    return await new Promise<boolean>(res => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(val, key)
      tx.oncomplete = () => res(true)
      tx.onerror = () => res(false)
      tx.onabort = () => res(false)
    })
  } catch { return false }
}
export async function idbDel(key: string): Promise<void> {
  try {
    const db = await open()
    await new Promise<void>(res => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(key)
      tx.oncomplete = () => res(); tx.onerror = () => res(); tx.onabort = () => res()
    })
  } catch { /* ignore */ }
}
export function readJSON<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback }
}
export function writeJSON(key: string, val: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(val)); return true } catch { return false }
}
