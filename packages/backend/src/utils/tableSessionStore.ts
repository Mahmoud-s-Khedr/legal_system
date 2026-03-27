import { randomUUID } from "node:crypto";

const DEFAULT_TTL_MS = 15 * 60 * 1000;

interface TableSessionEntry<T> {
  id: string;
  kind: string;
  ownerKey: string;
  createdAt: number;
  expiresAt: number;
  rows: T[];
  meta?: Record<string, unknown>;
}

const tableSessionStore = new Map<string, TableSessionEntry<unknown>>();

function pruneExpiredSessions(now = Date.now()) {
  for (const [id, entry] of tableSessionStore.entries()) {
    if (entry.expiresAt <= now) {
      tableSessionStore.delete(id);
    }
  }
}

export function createTableSession<T>(
  kind: string,
  ownerKey: string,
  rows: T[],
  options: { ttlMs?: number; meta?: Record<string, unknown> } = {}
) {
  pruneExpiredSessions();
  const createdAt = Date.now();
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const id = `${kind}_${randomUUID()}`;

  const entry: TableSessionEntry<T> = {
    id,
    kind,
    ownerKey,
    createdAt,
    expiresAt: createdAt + ttlMs,
    rows,
    meta: options.meta
  };
  tableSessionStore.set(id, entry as TableSessionEntry<unknown>);

  return {
    id,
    createdAt: new Date(entry.createdAt).toISOString(),
    expiresAt: new Date(entry.expiresAt).toISOString()
  };
}

export function getTableSession<T>(kind: string, ownerKey: string, id: string) {
  pruneExpiredSessions();
  const entry = tableSessionStore.get(id);
  if (!entry) {
    return null;
  }
  if (entry.kind !== kind || entry.ownerKey !== ownerKey) {
    return null;
  }
  return entry as TableSessionEntry<T>;
}

