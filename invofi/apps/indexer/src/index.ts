#!/usr/bin/env tsx
// InvoFi protocol indexer (Task 13).
//
// Reads protocol events via Soroban RPC (getEvents) from all five contracts,
// maintains a ledger checkpoint, and writes aggregate stats to a small
// Supabase Postgres table (`protocol_stats`, single row id=1). The /stats
// frontend page (Task 14) reads that row.
//
// Accuracy model (DoD: "counts match manual testnet inspection"):
//   - Counts/volumes that the contracts already maintain on-chain
//     (registry.get_stats: total_invoices/offers/financed/repaid, and
//     insurance.get_pool_total) are read directly and win — they are the
//     authoritative source by construction.
//   - Event replay (checkpointed, incremental) is used for aggregates the
//     contracts do not expose: unique active lenders and defaulted count,
//     and as an independent cross-check of on-chain totals.
//   - A reconciliation log line reports event-derived volume vs on-chain
//     volume so divergence is visible in the Action run.
import { rpc, scValToNative } from '@stellar/stellar-sdk';
import { db, loadStats, saveStats, type ProtocolStats } from './db';
import {
  fetchEventsFromCursor,
  fetchEventsFromRange,
  readInsurancePool,
  readRegistryStats,
  type ChainConfig,
} from './chain';
import { EVENT_NAMES } from './events';

// ── Config (env) ─────────────────────────────────────────────────────────────
function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

const CFG: ChainConfig = {
  rpcUrl: env('RPC_URL'),
  networkPassphrase: env('NETWORK_PASSPHRASE'),
  registryId: env('REGISTRY_CONTRACT_ID'),
  financingId: env('FINANCING_CONTRACT_ID'),
  repaymentId: env('REPAYMENT_CONTRACT_ID'),
  insuranceId: env('INSURANCE_CONTRACT_ID'),
  reputationId: env('REPUTATION_CONTRACT_ID'),
};

const SUPABASE_URL = env('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');

/**
 * Ledgers to walk back on the very first run (no checkpoint yet). Defaults
 * to 100k — safely inside the RPC's ~121k event-retention window, so the
 * first run typically needs no boundary clamping. Env-overridable.
 */
const BACKFILL_LEDGERS = Number(process.env.INDEXER_BACKFILL_LEDGERS ?? 100_000);
/** Safety cap: never query more than this many ledgers in one run. */
const MAX_WINDOW_LEDGERS = Number(process.env.INDEXER_MAX_WINDOW ?? 2_000_000);

interface EventAggregates {
  eventCounts: Map<string, number>;
  lenders: Set<string>;
  defaulted: number;
  volumeFromEvents: bigint;
  repaidFromEvents: bigint;
}

function emptyAggregates(): EventAggregates {
  return {
    eventCounts: new Map(),
    lenders: new Set(),
    defaulted: 0,
    volumeFromEvents: 0n,
    repaidFromEvents: 0n,
  };
}

/** Decode a protocol event and fold it into the aggregates. */
function foldEvent(agg: EventAggregates, topic: rpc.Api.EventResponse['topic'], value: unknown): void {
  const name = scValToNative(topic[0]) as string;
  if (!EVENT_NAMES.has(name)) return; // unknown event (e.g. newer contract) — skip

  agg.eventCounts.set(name, (agg.eventCounts.get(name) ?? 0) + 1);

  if (name === 'off_acc') {
    // value = (invoice_id, lender, amount)
    const [, lender, amount] = value as [string, string, bigint];
    agg.lenders.add(lender);
    agg.volumeFromEvents += BigInt(amount);
  } else if (name === 'inv_rep') {
    // value = (offer_id, amount, fully_repaid)
    const [, amount, fullyRepaid] = value as [string, bigint, boolean];
    if (fullyRepaid) agg.repaidFromEvents += BigInt(amount);
  } else if (name === 'off_def') {
    agg.defaulted += 1;
  }
}

async function main(): Promise<void> {
  const client = db({ supabaseUrl: SUPABASE_URL, supabaseServiceKey: SUPABASE_SERVICE_KEY });
  const rpcServer = new rpc.Server(CFG.rpcUrl);
  const latestLedger = (await rpcServer.getLatestLedger()).sequence;

  // ── Authoritative on-chain numbers ────────────────────────────────────────
  const onchain = await readRegistryStats(CFG);
  const insurancePool = await readInsurancePool(CFG);

  // ── Checkpoint / event replay ─────────────────────────────────────────────
  const prev = await loadStats(client);
  const checkpoint = prev?.last_ledger ?? Math.max(1, latestLedger - BACKFILL_LEDGERS);
  const endLedger = latestLedger;

  const agg = emptyAggregates();
  let lastProcessedLedger = checkpoint;
  let pages = 0;

  if (checkpoint < endLedger) {
    const window = endLedger - checkpoint;
    if (window > MAX_WINDOW_LEDGERS) {
      console.warn(
        `WARN: event window ${window} ledgers exceeds cap ${MAX_WINDOW_LEDGERS}; processing ${MAX_WINDOW_LEDGERS}.`,
      );
    }
    const start = Math.max(1, endLedger - Math.min(window, MAX_WINDOW_LEDGERS));

    // First page: ledger-range query (clamps to the RPC retention window).
    // Subsequent pages: cursor query (the SDK's GetEventsRequest union
    // forbids passing both).
    let page: { events: rpc.Api.EventResponse[]; cursor: string } = await fetchEventsFromRange(
      CFG,
      start,
      endLedger,
    );
    for (;;) {
      pages += 1;
      if (page.events.length > 0) {
        lastProcessedLedger = endLedger;
      }
      for (const ev of page.events) {
        let value: unknown;
        try {
          value = scValToNative(ev.value);
        } catch {
          continue;
        }
        foldEvent(agg, ev.topic, value);
      }
      if (page.events.length === 0 || pages > 200) {
        if (pages > 200) console.warn('WARN: pagination guard hit (200 pages) — stopping early');
        break;
      }
      page = await fetchEventsFromCursor(CFG, page.cursor);
    }
  } else {
    console.log(`No new events (checkpoint ${checkpoint} >= latest ${endLedger})`);
  }
  if (pages === 1 && agg.eventCounts.size === 0) {
    console.warn('WARN: no protocol events found in the retention window — the checkpoint may be stale');
  }

  // ── Reconciliation ────────────────────────────────────────────────────────
  const onchainFinanced = onchain.totalFinanced;
  console.log('── Reconciliation (events vs on-chain) ──');
  console.log(`  on-chain financed: ${onchainFinanced}   events financed: ${agg.volumeFromEvents}`);
  if (onchainFinanced !== agg.volumeFromEvents) {
    console.warn(`  MISMATCH: events saw ${agg.volumeFromEvents}, on-chain says ${onchainFinanced}`);
  } else {
    console.log('  OK: event volume matches on-chain total_financed');
  }

  // ── Write stats row ───────────────────────────────────────────────────────
  const invoicesFinanced = agg.eventCounts.get('off_acc') ?? 0;
  const totalRepaid = onchain.totalRepaid;
  const totalVolume = onchain.totalFinanced;
  const repaymentRate =
    totalVolume > 0n ? Number(totalRepaid) / Number(totalVolume) : 0;

  const stats: ProtocolStats = {
    id: 1,
    total_invoices: onchain.totalInvoices,
    total_offers: onchain.totalOffers,
    invoices_financed: invoicesFinanced,
    total_volume: totalVolume.toString(),
    total_repaid: totalRepaid.toString(),
    repayment_rate: Math.min(1, Math.max(0, Number.isFinite(repaymentRate) ? repaymentRate : 0)),
    active_lenders: agg.lenders.size,
    defaulted_invoices: agg.defaulted,
    insurance_pool: insurancePool.toString(),
    last_ledger: Math.max(lastProcessedLedger, checkpoint),
  };

  await saveStats(client, stats);

  console.log('── Stats written ──');
  console.log(JSON.stringify(stats, null, 2));
  console.log(`pages=${pages} events=${[...agg.eventCounts.entries()].map(([k, v]) => `${k}:${v}`).join(' ')}`);
}

main().catch(err => {
  console.error('Indexer failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
