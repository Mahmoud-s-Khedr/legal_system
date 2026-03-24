import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "../../config/env.js";

interface LocalSession {
  userId: string;
  createdAt: number;
}

class LocalSessionStore {
  private readonly storePath: string;
  private readonly sessions = new Map<string, LocalSession>();

  constructor() {
    const env = loadEnv();
    const configuredPath = env.LOCAL_SESSION_STORE_PATH?.trim();
    this.storePath = configuredPath && configuredPath.length > 0
      ? configuredPath
      : path.resolve("./.elms/local-session-store.json");
    this.hydrateFromDisk();
    this.pruneExpiredSessions();
  }

  private sessionTtlMs() {
    return loadEnv().LOCAL_SESSION_TTL_HOURS * 3_600_000;
  }

  private hydrateFromDisk() {
    try {
      if (!fs.existsSync(this.storePath)) {
        return;
      }

      const raw = fs.readFileSync(this.storePath, "utf8");
      if (!raw.trim()) {
        return;
      }

      const parsed = JSON.parse(raw) as Record<string, LocalSession>;
      for (const [sessionId, session] of Object.entries(parsed)) {
        if (
          typeof session?.userId === "string"
          && typeof session?.createdAt === "number"
        ) {
          this.sessions.set(sessionId, {
            userId: session.userId,
            createdAt: session.createdAt
          });
        }
      }
    } catch {
      // Treat malformed session store as empty to avoid blocking desktop startup.
      this.sessions.clear();
    }
  }

  private persistToDisk() {
    const storeDir = path.dirname(this.storePath);
    fs.mkdirSync(storeDir, { recursive: true });

    const payload = JSON.stringify(Object.fromEntries(this.sessions), null, 2);
    fs.writeFileSync(this.storePath, payload, "utf8");
  }

  private pruneExpiredSessions() {
    const ttlMs = this.sessionTtlMs();
    const now = Date.now();
    let changed = false;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.createdAt > ttlMs) {
        this.sessions.delete(sessionId);
        changed = true;
      }
    }

    if (changed) {
      this.persistToDisk();
    }
  }

  create(userId: string) {
    this.pruneExpiredSessions();
    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      userId,
      createdAt: Date.now()
    });
    this.persistToDisk();
    return sessionId;
  }

  resolve(sessionId?: string) {
    if (!sessionId) {
      return null;
    }

    this.pruneExpiredSessions();
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const ttlMs = this.sessionTtlMs();
    if (Date.now() - session.createdAt > ttlMs) {
      this.sessions.delete(sessionId);
      this.persistToDisk();
      return null;
    }

    return session;
  }

  destroy(sessionId?: string) {
    if (!sessionId) {
      return;
    }

    if (this.sessions.delete(sessionId)) {
      this.persistToDisk();
    }
  }
}

export const localSessionStore = new LocalSessionStore();
