type StoreName = 'kv' | 'outbox'

export type OfflineKvRecord<T = unknown> = {
  key: string
  value: T
  updatedAt: number
}

export type OfflineOutboxExpenseCreate = {
  id: string
  userId: string
  tripId: number
  kind: 'expense.create'
  localId: string
  clientGeneratedId: string
  payload: Record<string, unknown>
  createdAt: number
  lastError?: string | null
}

let _dbPromise: Promise<IDBDatabase> | null = null

function requestToPromise<T>(req: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function makeStorable(value: unknown) {
  if (typeof structuredClone === 'function') {
    try {
      return { ok: true as const, value: structuredClone(value) }
    } catch {}
  }

  try {
    return { ok: true as const, value: JSON.parse(JSON.stringify(value)) }
  } catch {
    return { ok: false as const, value: null }
  }
}

function transactionDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

async function openOfflineDb() {
  if (!import.meta.client) throw new Error('offline-db-client-only')
  if (_dbPromise) return _dbPromise

  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open('jizou-offline', 1)

    req.onupgradeneeded = () => {
      const db = req.result

      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'key' })
      }

      if (!db.objectStoreNames.contains('outbox')) {
        const outbox = db.createObjectStore('outbox', { keyPath: 'id' })
        outbox.createIndex('by_user', 'userId', { unique: false })
        outbox.createIndex('by_user_trip', ['userId', 'tripId'], { unique: false })
        outbox.createIndex('by_user_kind', ['userId', 'kind'], { unique: false })
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

  return _dbPromise
}

export async function offlineKvGet<T>(key: string) {
  if (!import.meta.client) return null
  const db = await openOfflineDb()
  const tx = db.transaction('kv', 'readonly')
  const store = tx.objectStore('kv')
  const rec = await requestToPromise<OfflineKvRecord<T> | undefined>(store.get(key) as any).catch(() => undefined)
  await transactionDone(tx).catch(() => undefined)
  return rec?.value ?? null
}

export async function offlineKvSet<T>(key: string, value: T) {
  if (!import.meta.client) return
  const storable = makeStorable(value)
  if (!storable.ok) return
  const db = await openOfflineDb()
  const tx = db.transaction('kv', 'readwrite')
  const store = tx.objectStore('kv')
  await requestToPromise(store.put({ key, value: storable.value, updatedAt: Date.now() } satisfies OfflineKvRecord))
  await transactionDone(tx)
}

export async function offlineKvDel(key: string) {
  if (!import.meta.client) return
  const db = await openOfflineDb()
  const tx = db.transaction('kv', 'readwrite')
  const store = tx.objectStore('kv')
  await requestToPromise(store.delete(key))
  await transactionDone(tx)
}

export async function offlineOutboxPut(item: OfflineOutboxExpenseCreate) {
  if (!import.meta.client) return
  const db = await openOfflineDb()
  const tx = db.transaction('outbox', 'readwrite')
  const store = tx.objectStore('outbox')
  await requestToPromise(store.put(item))
  await transactionDone(tx)
}

export async function offlineOutboxDelete(id: string) {
  if (!import.meta.client) return
  const db = await openOfflineDb()
  const tx = db.transaction('outbox', 'readwrite')
  const store = tx.objectStore('outbox')
  await requestToPromise(store.delete(id))
  await transactionDone(tx)
}

export async function offlineOutboxListExpenseCreatesForTrip(userId: string, tripId: number) {
  if (!import.meta.client) return [] as OfflineOutboxExpenseCreate[]
  const db = await openOfflineDb()
  const tx = db.transaction('outbox', 'readonly')
  const store = tx.objectStore('outbox')
  const index = store.index('by_user_trip')
  const res = await requestToPromise<OfflineOutboxExpenseCreate[]>(index.getAll([userId, tripId]))
  await transactionDone(tx).catch(() => undefined)
  return (Array.isArray(res) ? res : [])
    .filter(i => i?.kind === 'expense.create')
    .sort((a, b) => a.createdAt - b.createdAt)
}

export async function offlineOutboxListTripIds(userId: string) {
  if (!import.meta.client) return [] as number[]
  const db = await openOfflineDb()
  const tx = db.transaction('outbox', 'readonly')
  const store = tx.objectStore('outbox')
  const index = store.index('by_user')
  const res = await requestToPromise<OfflineOutboxExpenseCreate[]>(index.getAll(userId))
  await transactionDone(tx).catch(() => undefined)
  const set = new Set<number>()
  for (const item of (Array.isArray(res) ? res : [])) {
    if (item?.kind === 'expense.create' && Number.isFinite(item.tripId)) set.add(item.tripId)
  }
  return Array.from(set.values())
}
