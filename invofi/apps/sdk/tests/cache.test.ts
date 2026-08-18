/**
 * Unit tests — offline cache (IndexedDB, stale-while-revalidate) (Task 218)
 *
 * Strategy
 * --------
 * - Node's default Vitest environment has no `indexedDB` global, so we
 *   polyfill it via `fake-indexeddb/auto`, which installs `indexedDB` plus
 *   the full IDBRequest/IDBCursor/IDBKeyRange/etc. constructor set that
 *   `idb` (the wrapper `src/cache.ts` uses) needs for its instanceof checks.
 * - `src/cache.ts` opens ONE memoized connection for the module's lifetime
 *   (a realistic long-lived app connection). We import it once, statically,
 *   and reuse that same connection across every test — NOT
 *   `vi.resetModules()` + a fresh `indexedDB.deleteDatabase()` per test.
 *   That combination deadlocks: `deleteDatabase()` blocks forever on the
 *   still-open connection from the previous test (nothing ever closes it),
 *   and — because IndexedDB processes requests against a given database in
 *   order — every `open()` issued afterwards queues up behind that stuck
 *   `delete()` and never resolves either. Instead, `beforeEach` clears the
 *   object store's contents via a short-lived side connection (opening the
 *   same DB/version alongside the long-lived one is fine; no version change,
 *   no blocking).
 * - The "no indexedDB" tests delete/restore `globalThis.indexedDB` directly.
 *   This works without any module reset because every exported function in
 *   `src/cache.ts` checks `isIndexedDbAvailable()` fresh on *every call*,
 *   before ever touching the memoized connection promise.
 *
 * Coverage
 * --------
 * 1. Basic get/set round-trip — schema fields (key/data/timestamp/version)
 * 2. TTL / staleness semantics per data-type prefix (CACHE_TTL_MS)
 * 3. staleWhileRevalidate — immediate cached read + silent background update
 * 4. Promise.allSettled graceful degradation — fetcher rejects, stale data kept
 * 5. Prefix-based invalidate() — exact key and prefix-family deletion
 * 6. LRU eviction — least-recently-accessed entries evicted first over budget
 * 7. Environment guard — safe no-op when indexedDB is unavailable
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// Installs indexedDB + IDBRequest/IDBCursor/IDBKeyRange/etc. as globals —
// `idb` (the wrapper `src/cache.ts` uses) needs the full constructor set,
// not just `indexedDB` itself, to build its promise-based instanceof checks.
import 'fake-indexeddb/auto';

import * as cache from '../src/cache';

const DB_NAME = 'invofi-cache';
const STORE_NAME = 'invofi-cache';

/**
 * Clears the object store's contents via a short-lived side connection,
 * without ever closing (or blocking on) the cache module's own long-lived
 * connection. Creates the store first if it doesn't exist yet (first run).
 */
function clearStore(): Promise<void> {
  return new Promise((resolve, reject) => {
    const openReq = indexedDB.open(DB_NAME, 1);
    openReq.onupgradeneeded = () => {
      const db = openReq.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('lastAccessed', 'lastAccessed');
      }
    };
    openReq.onsuccess = () => {
      const db = openReq.result;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
    openReq.onerror = () => reject(openReq.error);
  });
}

beforeEach(async () => {
  await clearStore();
});

// ── 1. Basic get/set round-trip ───────────────────────────────────────────────

describe('cache — get/set round-trip', () => {
  it('returns null for a missing key', async () => {
    expect(await cache.getCached('invoices:Pending:1')).toBeNull();
  });

  it('round-trips data with the correct schema fields', async () => {
    const before = Date.now();
    await cache.setCached('offers:inv_001', { foo: 'bar' }, 3);
    const entry = await cache.getCached<{ foo: string }>('offers:inv_001');

    expect(entry).not.toBeNull();
    expect(entry!.key).toBe('offers:inv_001');
    expect(entry!.data).toEqual({ foo: 'bar' });
    expect(entry!.version).toBe(3);
    expect(entry!.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry!.timestamp).toBeLessThanOrEqual(Date.now());
  });

  it('defaults version to 1 when not supplied', async () => {
    await cache.setCached('positions:GLENDER123', { balance: 100n });
    const entry = await cache.getCached('positions:GLENDER123');
    expect(entry!.version).toBe(1);
  });

  it('overwrites an existing entry on a second setCached for the same key', async () => {
    await cache.setCached('offers:inv_001', { v: 1 });
    await cache.setCached('offers:inv_001', { v: 2 });
    const entry = await cache.getCached<{ v: number }>('offers:inv_001');
    expect(entry!.data).toEqual({ v: 2 });
  });

  it('handles bigint fields in cached data (Invoice/FinancingOffer shapes)', async () => {
    await cache.setCached('invoices:Pending:1', { amount: 5_000_000n });
    const entry = await cache.getCached<{ amount: bigint }>('invoices:Pending:1');
    expect(entry!.data.amount).toBe(5_000_000n);
  });
});

// ── 2. TTL / staleness config ─────────────────────────────────────────────────

describe('cache — CACHE_TTL_MS config', () => {
  it('defines the required per-type TTLs', () => {
    expect(cache.CACHE_TTL_MS.invoices).toBe(5 * 60_000);
    expect(cache.CACHE_TTL_MS.offers).toBe(2 * 60_000);
    expect(cache.CACHE_TTL_MS.positions).toBe(60_000);
  });
});

// ── 3. staleWhileRevalidate ────────────────────────────────────────────────────

describe('cache — staleWhileRevalidate', () => {
  it('returns null data and isStale=true on a cold cache, then updates the cache in the background', async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 'inv_1' });

    const result = await cache.staleWhileRevalidate('invoices:Pending:1', 5_000, fetcher);
    expect(result.data).toBeNull();
    expect(result.isStale).toBe(true);

    const fresh = await result.refresh;
    expect(fresh).toEqual({ id: 'inv_1' });
    expect(fetcher).toHaveBeenCalledOnce();

    const entry = await cache.getCached('invoices:Pending:1');
    expect(entry!.data).toEqual({ id: 'inv_1' });
  });

  it('returns cached data immediately (isStale=false) while still refreshing in the background', async () => {
    await cache.setCached('offers:inv_002', { id: 'off_1', v: 1 });

    const fetcher = vi.fn().mockResolvedValue({ id: 'off_1', v: 2 });
    const result = await cache.staleWhileRevalidate('offers:inv_002', 60_000, fetcher);

    // Fresh cache read comes back immediately, synchronously available.
    expect(result.data).toEqual({ id: 'off_1', v: 1 });
    expect(result.isStale).toBe(false);

    await result.refresh;
    const updated = await cache.getCached('offers:inv_002');
    expect(updated!.data).toEqual({ id: 'off_1', v: 2 });
  });

  it('marks an entry older than the TTL as stale', async () => {
    // Real (short) delay rather than fake timers — fake-indexeddb schedules
    // its request callbacks via real timers/microtasks internally, so
    // vi.useFakeTimers() here would starve `idb`'s promises and hang the test.
    const tinyTtlMs = 5;
    await cache.setCached('positions:GLENDER', { balance: 1 });
    await new Promise(resolve => setTimeout(resolve, tinyTtlMs + 15));

    const fetcher = vi.fn().mockResolvedValue({ balance: 2 });
    const result = await cache.staleWhileRevalidate('positions:GLENDER', tinyTtlMs, fetcher);
    expect(result.data).toEqual({ balance: 1 }); // stale value still returned
    expect(result.isStale).toBe(true);
  });

  // ── 4. Promise.allSettled graceful degradation ──────────────────────────────

  it('keeps the stale cache entry intact and does not throw when the background fetch rejects', async () => {
    await cache.setCached('invoices:Financed:1', { id: 'inv_9' });

    const fetcher = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await cache.staleWhileRevalidate('invoices:Financed:1', 60_000, fetcher);

    expect(result.data).toEqual({ id: 'inv_9' });
    await expect(result.refresh).resolves.toBeNull(); // does not throw or reject

    const stillCached = await cache.getCached('invoices:Financed:1');
    expect(stillCached!.data).toEqual({ id: 'inv_9' }); // untouched
  });

  it('never throws even with no prior cache entry and a rejecting fetcher', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('boom'));
    const result = await cache.staleWhileRevalidate('offers:inv_none', 60_000, fetcher);
    expect(result.data).toBeNull();
    await expect(result.refresh).resolves.toBeNull();
  });
});

// ── 5. invalidate() ────────────────────────────────────────────────────────────

describe('cache — invalidate', () => {
  it('deletes an exact key', async () => {
    await cache.setCached('offers:inv_001', { a: 1 });
    await cache.invalidate('offers:inv_001');
    expect(await cache.getCached('offers:inv_001')).toBeNull();
  });

  it('deletes every key sharing a prefix, leaving unrelated keys untouched', async () => {
    await cache.setCached('invoices:Pending:1', { p: 1 });
    await cache.setCached('invoices:Pending:2', { p: 2 });
    await cache.setCached('invoices:Financed:1', { p: 3 });
    await cache.setCached('offers:inv_001', { p: 4 });

    await cache.invalidate('invoices:');

    expect(await cache.getCached('invoices:Pending:1')).toBeNull();
    expect(await cache.getCached('invoices:Pending:2')).toBeNull();
    expect(await cache.getCached('invoices:Financed:1')).toBeNull();
    expect(await cache.getCached('offers:inv_001')).not.toBeNull();
  });

  it('is a no-op (does not throw) for a key/prefix that matches nothing', async () => {
    await expect(cache.invalidate('nonexistent:')).resolves.toBeUndefined();
  });
});

// ── 6. LRU eviction ─────────────────────────────────────────────────────────────

const MAX_CACHE_SIZE_BYTES_FOR_TEST = 50 * 1024 * 1024;

describe('cache — LRU eviction', () => {
  it('evicts least-recently-accessed entries once the size threshold is exceeded', async () => {
    // Small threshold so the test doesn't need to write anywhere near 50MB.
    // Sized to fit exactly two of these ~equal-size entries (plus slack) so
    // adding the third forces exactly one eviction — the least-recently-used
    // one — rather than evicting two entries down to a single survivor.
    const sampleEntrySize = JSON.stringify({
      key: 'positions:A',
      data: { blob: 'x'.repeat(50) },
      timestamp: Date.now(),
      version: 1,
      lastAccessed: Date.now(),
    }).length;
    const tinyThreshold = sampleEntrySize * 2 + 20;
    // A tiny real delay between each step guarantees strictly increasing
    // `lastAccessed` millisecond timestamps — without it, operations can
    // complete fast enough to tie, making the LRU sort order (and therefore
    // which entry gets evicted) nondeterministic.
    const tick = () => new Promise(resolve => setTimeout(resolve, 2));

    await cache.setCached('positions:A', { blob: 'x'.repeat(50) }, 1, tinyThreshold);
    await tick();
    await cache.setCached('positions:B', { blob: 'x'.repeat(50) }, 1, tinyThreshold);
    await tick();
    // Access A again so B becomes the least-recently-accessed entry.
    await cache.getCached('positions:A');
    await tick();
    // This write pushes the store over budget and triggers eviction.
    await cache.setCached('positions:C', { blob: 'x'.repeat(50) }, 1, tinyThreshold);

    const a = await cache.getCached('positions:A');
    const b = await cache.getCached('positions:B');
    const c = await cache.getCached('positions:C');

    // B was least-recently-accessed and should have been evicted first.
    expect(b).toBeNull();
    expect(c).not.toBeNull();
    expect(a).not.toBeNull();
  });

  it('does not evict anything when under the size threshold', async () => {
    await cache.setCached('positions:A', { small: 1 }, 1, MAX_CACHE_SIZE_BYTES_FOR_TEST);
    await cache.setCached('positions:B', { small: 2 }, 1, MAX_CACHE_SIZE_BYTES_FOR_TEST);
    expect(await cache.getCached('positions:A')).not.toBeNull();
    expect(await cache.getCached('positions:B')).not.toBeNull();
  });
});

// ── 7. Environment guard ─────────────────────────────────────────────────────

describe('cache — environment guard (no IndexedDB)', () => {
  // fake-indexeddb/auto installs `globalThis.indexedDB` once for the whole
  // file; these tests temporarily remove it to exercise the SSR/Node path,
  // then restore it so later tests (and other describe blocks) are unaffected.
  // No module reset is needed: every exported function re-checks
  // `isIndexedDbAvailable()` on each call before touching the memoized
  // connection, so flipping the global directly is sufficient.
  let savedIndexedDb: typeof indexedDB;

  beforeEach(() => {
    savedIndexedDb = globalThis.indexedDB;
    // @ts-expect-error — simulating an environment with no indexedDB global
    delete globalThis.indexedDB;
  });

  afterEach(() => {
    globalThis.indexedDB = savedIndexedDb;
  });

  it('isIndexedDbAvailable() reflects the current globalThis.indexedDB', () => {
    expect(cache.isIndexedDbAvailable()).toBe(false);

    globalThis.indexedDB = savedIndexedDb;
    expect(cache.isIndexedDbAvailable()).toBe(true);
  });

  it('getCached resolves null (never throws) when indexedDB is unavailable', async () => {
    await expect(cache.getCached('invoices:Pending:1')).resolves.toBeNull();
  });

  it('setCached resolves without effect (never throws) when indexedDB is unavailable', async () => {
    await expect(cache.setCached('invoices:Pending:1', { a: 1 })).resolves.toBeUndefined();
  });

  it('invalidate resolves without effect (never throws) when indexedDB is unavailable', async () => {
    await expect(cache.invalidate('invoices:')).resolves.toBeUndefined();
  });

  it('staleWhileRevalidate still calls the fetcher and resolves gracefully with no cache backing', async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 'inv_x' });

    const result = await cache.staleWhileRevalidate('invoices:Pending:1', 5_000, fetcher);
    expect(result.data).toBeNull();
    expect(result.isStale).toBe(true);
    await expect(result.refresh).resolves.toEqual({ id: 'inv_x' });
  });
});
