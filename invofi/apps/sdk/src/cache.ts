// ── SDK offline cache (IndexedDB, stale-while-revalidate) — Task 218 ────────
//
// Caches invoice/offer/position reads in IndexedDB (via the `idb` wrapper) so
// consumers can render immediately from a warm cache while a background
// refresh silently brings the data up to date ("stale-while-revalidate").
//
// This module is browser-only in spirit but MUST NOT assume a browser is
// present: the SDK is also consumed by a Next.js app that renders on the
// server, and by a Node CLI keeper (apps/scripts). Every exported function
// therefore guards on `isIndexedDbAvailable()` and degrades to a safe no-op
// (resolves `null`/`undefined` for reads, resolves without effect for
// writes) rather than throwing when `indexedDB` is unavailable — this is a
// load-bearing guarantee for SSR/Node callers, not an incidental detail.
//
// Usage:
//   import { staleWhileRevalidate, invalidate, CACHE_TTL_MS } from './cache';
//   const { data, isStale, refresh } = await staleWhileRevalidate(
//     `invoices:${status}:${page}`,
//     CACHE_TTL_MS.invoices,
//     () => fetchInvoicesFromChain(status, page),
//   );

import { openDB, type IDBPDatabase } from 'idb';

// ── Schema ────────────────────────────────────────────────────────────────────

/**
 * Public cache-entry shape. `version` is a caller-controlled schema/format
 * tag (defaults to 1) so future format changes can be detected and ignored
 * rather than mis-parsed.
 */
export interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  version: number;
}

/** Internal on-disk shape: a `CacheEntry` plus LRU bookkeeping. */
interface StoredEntry<T> extends CacheEntry<T> {
  /** Updated on every `getCached` read; drives LRU eviction order. */
  lastAccessed: number;
}

const DB_NAME = 'invofi-cache';
const DB_VERSION = 1;
const STORE_NAME = 'invofi-cache';
const LAST_ACCESSED_INDEX = 'lastAccessed';

// ── TTL config (per cache-key prefix) ────────────────────────────────────────
// Keyed by the same prefix used in cache keys ("invoices:{status}:{page}",
// "offers:{invoiceId}", "positions:{lender}") so callers can look up the
// right TTL from the key prefix. Exported so consumers can inspect/override
// and so it is independently unit-testable.

export const CACHE_TTL_MS: Record<'invoices' | 'offers' | 'positions', number> = {
  invoices: 5 * 60_000,
  offers: 2 * 60_000,
  positions: 60_000,
};

/**
 * Total estimated cache size (sum of `JSON.stringify(entry).length` across
 * all entries) above which the LRU sweep evicts least-recently-accessed
 * entries. 50 MB per the Task 218 storage-limit requirement.
 */
export const MAX_CACHE_SIZE_BYTES = 50 * 1024 * 1024;

// ── Environment guard ────────────────────────────────────────────────────────

/**
 * True when a usable `indexedDB` global is present. Checked lazily on every
 * call (not cached at module-load time) so SSR/Node callers — where
 * `indexedDB` is simply absent from `globalThis` — always resolve to a safe
 * no-op instead of throwing a ReferenceError.
 */
export function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

/** JSON.stringify that tolerates bigint fields (Invoice/FinancingOffer use bigint amounts). */
function safeStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
}

let dbPromise: Promise<IDBPDatabase> | null = null;

/**
 * Lazily opens (and memoizes) the cache database. Returns `null` when
 * IndexedDB is unavailable — callers must treat that as "no-op".
 */
function getDb(): Promise<IDBPDatabase> | null {
  if (!isIndexedDbAvailable()) return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex(LAST_ACCESSED_INDEX, 'lastAccessed');
        }
      },
    });
  }
  return dbPromise;
}

// ── Reads ─────────────────────────────────────────────────────────────────────

/**
 * Reads a cache entry by exact key, regardless of staleness — TTL/staleness
 * is the caller's decision (see `staleWhileRevalidate`). Also bumps
 * `lastAccessed` for LRU purposes.
 *
 * Resolves `null` when the entry is missing OR when IndexedDB is
 * unavailable (SSR/Node) — never throws.
 */
export async function getCached<T>(key: string): Promise<CacheEntry<T> | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const conn = await db;
    const tx = conn.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const entry = (await store.get(key)) as StoredEntry<T> | undefined;
    if (!entry) {
      await tx.done;
      return null;
    }
    entry.lastAccessed = Date.now();
    await store.put(entry);
    await tx.done;
    return { key: entry.key, data: entry.data, timestamp: entry.timestamp, version: entry.version };
  } catch {
    // Corrupt entry, blocked transaction, etc. — degrade to "no cache".
    return null;
  }
}

// ── Writes ────────────────────────────────────────────────────────────────────

/**
 * Writes a cache entry (upsert by `key`) with the current timestamp, then
 * runs an LRU-eviction sweep (awaited, not fire-and-forget — so a caller
 * that awaits `setCached` is guaranteed the store is back under budget
 * before it resolves) if the estimated total store size exceeds
 * `maxSizeBytes` (defaults to `MAX_CACHE_SIZE_BYTES`; overridable for
 * testing).
 *
 * Resolves without effect when IndexedDB is unavailable — never throws.
 */
export async function setCached<T>(
  key: string,
  data: T,
  version = 1,
  maxSizeBytes: number = MAX_CACHE_SIZE_BYTES,
): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const conn = await db;
    const now = Date.now();
    const entry: StoredEntry<T> = { key, data, timestamp: now, version, lastAccessed: now };
    await conn.put(STORE_NAME, entry);
    await evictLru(conn, maxSizeBytes);
  } catch {
    // Write failures (quota exceeded, blocked, etc.) must not throw or
    // interrupt the caller — the cache is best-effort.
  }
}

/**
 * Evicts least-recently-accessed entries (oldest `lastAccessed` first) until
 * the estimated total store size is back under `maxSizeBytes`.
 */
async function evictLru(conn: IDBPDatabase, maxSizeBytes: number): Promise<void> {
  try {
    const all = (await conn.getAll(STORE_NAME)) as StoredEntry<unknown>[];
    let totalBytes = all.reduce((sum, e) => sum + safeStringify(e).length, 0);
    if (totalBytes <= maxSizeBytes) return;

    const oldestFirst = [...all].sort((a, b) => a.lastAccessed - b.lastAccessed);
    const tx = conn.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const entry of oldestFirst) {
      if (totalBytes <= maxSizeBytes) break;
      await store.delete(entry.key);
      totalBytes -= safeStringify(entry).length;
    }
    await tx.done;
  } catch {
    // Eviction is best-effort cleanup — a failure here must not surface to
    // the setCached caller (the write already succeeded).
  }
}

// ── Invalidation ──────────────────────────────────────────────────────────────

/**
 * Deletes a single exact key, or — when `keyOrPrefix` matches the start of
 * one or more stored keys — every key sharing that prefix (e.g.
 * `invalidate('invoices:')` clears every paginated `invoices:{status}:{page}`
 * entry after a mutation, since the mutation doesn't know every page that
 * might now be stale).
 *
 * Resolves without effect when IndexedDB is unavailable — never throws.
 */
export async function invalidate(keyOrPrefix: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const conn = await db;
    const tx = conn.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    let cursor = await store.openCursor();
    while (cursor) {
      const k = cursor.key;
      if (typeof k === 'string' && (k === keyOrPrefix || k.startsWith(keyOrPrefix))) {
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }
    await tx.done;
  } catch {
    // Best-effort — an invalidation failure should not throw into the
    // caller's mutation flow (the on-chain write already succeeded).
  }
}

// ── Stale-while-revalidate ───────────────────────────────────────────────────

export interface StaleWhileRevalidateResult<T> {
  /** Cached value, or `null` when there was no cache entry (or no IndexedDB). */
  data: T | null;
  /** True when `data` is missing or older than `ttlMs`. */
  isStale: boolean;
  /**
   * The background refresh. Resolves with the freshly-fetched value on
   * success (after silently writing it to the cache), or `null` if the
   * fetch failed — a failed refresh never throws and never touches (let
   * alone evicts) the still-valid stale cache entry. Callers that only
   * need the immediate cached read may safely ignore this promise.
   */
  refresh: Promise<T | null>;
}

/**
 * The core SWR entry point: reads the cache immediately (fast path), then
 * kicks off `fetcher()` in the background via `Promise.allSettled` so a
 * rejected fetch degrades gracefully instead of throwing or clearing the
 * still-good stale entry. On success the fresh value silently replaces the
 * cache entry.
 *
 * `data`/`isStale` are ready as soon as the returned promise resolves (a
 * single fast IndexedDB read); `refresh` is a separate promise the caller
 * can `await` or ignore.
 */
export async function staleWhileRevalidate<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<StaleWhileRevalidateResult<T>> {
  const cached = await getCached<T>(key);
  const isStale = !cached || Date.now() - cached.timestamp > ttlMs;

  const refresh: Promise<T | null> = (async () => {
    const [outcome] = await Promise.allSettled([fetcher()]);
    if (outcome.status === 'fulfilled') {
      await setCached(key, outcome.value, cached?.version ?? 1);
      return outcome.value;
    }
    // Swallow the failure — the stale cache entry (if any) is left intact.
    return null;
  })();

  return {
    data: cached ? cached.data : null,
    isStale,
    refresh,
  };
}
