/**
 * IndexedDB-backed write queue for offline mutations.
 * Queued requests are replayed in order when the browser comes back online.
 */

const DB_NAME = "elms-sync-queue";
const STORE_NAME = "pending-requests";
const DB_VERSION = 1;

export interface QueuedRequest {
  id?: number;
  url: string;
  method: string;
  body: string | null;
  headers: Record<string, string>;
  enqueuedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, {
        keyPath: "id",
        autoIncrement: true
      });
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(request: Omit<QueuedRequest, "id" | "enqueuedAt">): Promise<void> {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add({ ...request, enqueuedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
}

export async function dequeueAll(): Promise<QueuedRequest[]> {
  const db = await openDb();

  const items = await new Promise<QueuedRequest[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as QueuedRequest[]);
    req.onerror = () => reject(req.error);
  });

  db.close();
  return items;
}

async function deleteById(id: number): Promise<void> {
  const db = await openDb();

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
}

/**
 * Replay all queued requests in insertion order.
 * Successfully replayed items are removed from the queue.
 * Failed items remain so they can be retried on the next reconnect.
 */
export async function replayQueue(): Promise<{ replayed: number; failed: number }> {
  const pending = await dequeueAll();
  let replayed = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body ?? undefined
      });

      if (response.ok) {
        if (item.id !== undefined) {
          await deleteById(item.id);
        }
        replayed++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { replayed, failed };
}

/**
 * Start listening for online events and replay the queue automatically.
 * Call once at app startup (cloud mode only).
 */
export function startSyncQueueReplay(onComplete?: (result: { replayed: number; failed: number }) => void): () => void {
  async function handleOnline() {
    const result = await replayQueue();
    onComplete?.(result);
  }

  window.addEventListener("online", handleOnline);

  return () => {
    window.removeEventListener("online", handleOnline);
  };
}
