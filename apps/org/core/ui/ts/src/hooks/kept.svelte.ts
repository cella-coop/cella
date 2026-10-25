// A member's devices as a browser keeps them: in IndexedDB, by scope and
// public key, each private key a CryptoKey the browser made and never
// exports, which only this origin's pages can use to sign. Browser only.

import type { Device } from '@cella/org-sign'

export interface Kept extends Device {
  // The scope the device is enrolled in, and the person it signs as.
  scope: string
  label: string
}

const STORE = 'devices'

function opened(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('cella', 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: ['scope', 'key'] })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function using<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await opened()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

// Keeps a device, replacing one of the same scope and key.
export async function keep(device: Kept): Promise<void> {
  await using('readwrite', (s) => s.put(device))
}

// The devices this browser keeps for a scope.
export async function kept(scope: string): Promise<Kept[]> {
  const all = await using<Kept[]>('readonly', (s) => s.getAll())
  return all.filter((d) => d.scope === scope)
}

// The device of a scope this browser keeps by its public key, if any.
export async function held(scope: string, key: string): Promise<Kept | null> {
  return (await using<Kept | undefined>('readonly', (s) => s.get([scope, key]))) ?? null
}
