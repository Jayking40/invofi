#!/usr/bin/env tsx
/**
 * InvoFi Keeper (Task 12)
 * =======================
 * Off-chain automation that runs on a schedule (GitHub Actions cron, every
 * 6h — see .github/workflows/keeper.yml). It does two jobs:
 *
 *  1. mark_overdue  — for every Financed invoice whose due_date has passed,
 *     call repayment.mark_overdue (a public, permissionless transition).
 *  2. bump_ttl      — best-effort TTL extension for the storage of active
 *     invoices, so contract state never expires on the Soroban network.
 *
 * Design notes (scalability-first, per Task 4's guidance):
 *  - Invoice discovery is PAGINATED from the start via
 *    registry.get_invoices_paginated(offset, limit) — bounded pages, never
 *    an unbounded on-chain list read. This stays cheap as the invoice count
 *    grows (Task 13's indexer will eventually supersede on-chain discovery).
 *  - TTL bumps are capped per run (MAX_TTL_BUMPS) and best-effort: a failure
 *    logs and continues. Polling is fine at this scale; the event-driven
 *    upgrade path (Soroban RPC event subscriptions) is a documented
 *    follow-up, not a blocker.
 *
 * Env vars:
 *  RPC_URL                Soroban RPC endpoint (default: soroban-testnet)
 *  NETWORK_PASSPHRASE     network passphrase (default: testnet)
 *  REGISTRY_CONTRACT_ID   registry contract (required)
 *  REPAYMENT_CONTRACT_ID  repayment contract (required)
 *  KEEPER_SECRET_KEY      secret key of the funded keeper account (required)
 *  PAGE_SIZE              invoices per page (default 50)
 *  MAX_TTL_BUMPS          max TTL extensions per run (default 50)
 *  TTL_EXTEND_LEDGERS     how many ledgers to extend TTL to (default ~30 days)
 *
 * On testnet the keeper account is auto-funded via Friendbot if missing.
 */

import {
  Contract,
  Keypair,
  Networks,
  Operation,
  SorobanDataBuilder,
  rpc as SorobanRpc,
  Transaction,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';

// ── Config ───────────────────────────────────────────────────────────────────

const RPC_URL = process.env.RPC_URL ?? 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE =
  process.env.NETWORK_PASSPHRASE ?? Networks.TESTNET;
const REGISTRY_ID = process.env.REGISTRY_CONTRACT_ID;
const REPAYMENT_ID = process.env.REPAYMENT_CONTRACT_ID;
const KEEPER_SECRET_KEY = process.env.KEEPER_SECRET_KEY;
const PAGE_SIZE = Number(process.env.PAGE_SIZE ?? 50);
const MAX_TTL_BUMPS = Number(process.env.MAX_TTL_BUMPS ?? 50);
const TTL_EXTEND_LEDGERS = Number(process.env.TTL_EXTEND_LEDGERS ?? 311_040); // ~30 days
const FEE = '100';
const MAX_PAGES = 2_000; // safety cap: 2_000 pages x PAGE_SIZE invoices max

const rpc = new SorobanRpc.Server(RPC_URL, { allowHttp: false });

// Contract enum discriminants (must match invofi-common):
// InvoiceStatus: Pending=0, Financed=1, Repaid=2, Overdue=3, Cancelled=4,
//                Disputed=5, Defaulted=6
const STATUS: Record<string, number> = {
  Pending: 0,
  Financed: 1,
  Repaid: 2,
  Overdue: 3,
  Cancelled: 4,
  Disputed: 5,
  Defaulted: 6,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function encodeSymbol(value: string): xdr.ScVal {
  return nativeToScVal(value, { type: 'symbol' });
}

function encodeU32(value: number): xdr.ScVal {
  return nativeToScVal(value, { type: 'u32' });
}

/** Defensively parse the serialized status (number | numeric string | name). */
function statusNum(value: unknown): number {
  if (typeof value === 'number') return value;
  const s = String(value);
  if (s in STATUS) return STATUS[s];
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) ? -1 : n;
}

async function getAccount(pub: string) {
  return rpc.getAccount(pub);
}

/** Fund the keeper account on testnet if it doesn't exist yet. */
async function ensureAccount(pub: string): Promise<void> {
  try {
    await rpc.getAccount(pub);
    return;
  } catch {
    /* account missing — fund below */
  }
  if (NETWORK_PASSPHRASE !== Networks.TESTNET) {
    throw new Error(`Account ${pub} missing and network is not testnet — fund it manually.`);
  }
  const net = await rpc.getNetwork();
  const friendbotUrl = net.friendbotUrl ?? 'https://friendbot.stellar.org';
  const url = `${friendbotUrl}?addr=${pub}`;
  log(`funding keeper account via friendbot: ${pub}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Friendbot funding failed (${res.status}): ${await res.text()}`);
  }
  // Friendbot can take a couple of ledgers to apply.
  for (let i = 0; i < 10; i++) {
    await sleep(1_000);
    try {
      await rpc.getAccount(pub);
      return;
    } catch {
      /* keep polling */
    }
  }
  throw new Error('Friendbot funded but account still not visible after 10s.');
}

async function sendAndConfirm(tx: Transaction): Promise<boolean> {
  const resp = await rpc.sendTransaction(tx);
  if (resp.status === 'ERROR') {
    log(`    send ERROR: ${resp.errorResult?.result().toXDR('base64')}`);
    return false;
  }
  if (resp.status === 'DUPLICATE') return true;
  for (let i = 0; i < 15; i++) {
    await sleep(2_000);
    const res = await rpc.getTransaction(resp.hash);
    if (res.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) return true;
    if (res.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      log(`    tx FAILED: ${res.resultXdr.toXDR('base64')}`);
      return false;
    }
  }
  log(`    tx ${resp.hash} timed out waiting for confirmation`);
  return false;
}

/** Read one page of invoices (bounded — the scalability-safe query). */
async function readInvoicePage(offset: number, pub: string): Promise<unknown[]> {
  const contract = new Contract(REGISTRY_ID!);
  const account = await rpc.getAccount(pub);
  const tx = new TransactionBuilder(account, {
    fee: FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('get_invoices_paginated', encodeU32(offset), encodeU32(PAGE_SIZE)))
    .setTimeout(30)
    .build();
  const sim = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`get_invoices_paginated sim error: ${sim.error}`);
  }
  const result = sim.result?.retval;
  if (!result) return [];
  const parsed = scValToNative(result);
  return Array.isArray(parsed) ? parsed : [];
}

/** Mark a single invoice overdue (public transition). Returns true on success. */
async function markOverdue(invoiceId: string, kp: Keypair): Promise<boolean> {
  const account = await getAccount(kp.publicKey());
  const contract = new Contract(REPAYMENT_ID!);
  let tx = new TransactionBuilder(account, {
    fee: FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('mark_overdue', encodeSymbol(invoiceId)))
    .setTimeout(30)
    .build();
  const sim = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    log(`    mark_overdue sim error: ${sim.error}`);
    return false;
  }
  tx = SorobanRpc.assembleTransaction(tx, sim).build();
  tx.sign(kp);
  return sendAndConfirm(tx);
}

/**
 * Best-effort TTL extension: probe a read of the invoice to learn the
 * storage footprint, then submit an extendFootprintTtl transaction covering
 * exactly that footprint (contract code + instance + invoice entry).
 *
 * Follows the Stellar docs pattern (extend-persistent-entry-js): fresh
 * SorobanDataBuilder with only the read-only footprint keys, a DELTA
 * `extendTo` (ledgers past LCL), then `server.prepareTransaction` to fill in
 * real resources + fee. Verified against soroban-testnet: the earlier naive
 * approaches (absolute extendTo, reusing the probe's SorobanTransactionData,
 * assembleTransaction) all failed with txBadSeq / extendFootprintTtlMalformed.
 */
async function bumpTtl(invoiceId: string, kp: Keypair): Promise<boolean> {
  try {
    const contract = new Contract(REGISTRY_ID!);

    // 1. Probe read — the simulated footprint is what we want to extend.
    // NOTE: TransactionBuilder consumes + increments the account's sequence on
    // every build, so each builder gets a FRESH account fetch (reuse would
    // shift the sequence and cause txBadSeq).
    const probe = new TransactionBuilder(await getAccount(kp.publicKey()), {
      fee: FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('get_invoice', encodeSymbol(invoiceId)))
      .setTimeout(30)
      .build();
    const sim = await rpc.simulateTransaction(probe);
    if (SorobanRpc.Api.isSimulationError(sim)) {
      log(`    ttl probe sim error: ${sim.error}`);
      return false;
    }
    const readOnlyKeys = sim.transactionData.build().resources().footprint().readOnly();

    // 2. extendFootprintTtl with the probed footprint, extendTo = ledgers past
    // LCL (a DELTA, per the Stellar docs — not an absolute ledger number).
    let bump = new TransactionBuilder(await getAccount(kp.publicKey()), {
      fee: FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .setSorobanData(new SorobanDataBuilder().setReadOnly(readOnlyKeys).build())
      .addOperation(Operation.extendFootprintTtl({ extendTo: TTL_EXTEND_LEDGERS }))
      .setTimeout(30)
      .build();

    // 3. prepareTransaction simulates and fills in the real resources + fee.
    bump = await rpc.prepareTransaction(bump);
    bump.sign(kp);
    return sendAndConfirm(bump);
  } catch (err) {
    log(`    ttl error for ${invoiceId}: ${(err as Error).message}`);
    return false;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!REGISTRY_ID || !REPAYMENT_ID) {
    throw new Error('REGISTRY_CONTRACT_ID and REPAYMENT_CONTRACT_ID are required.');
  }
  if (!KEEPER_SECRET_KEY) {
    throw new Error('KEEPER_SECRET_KEY is required (funded keeper account).');
  }

  const kp = Keypair.fromSecret(KEEPER_SECRET_KEY);
  const pub = kp.publicKey();
  await ensureAccount(pub);
  log(`keeper ${pub} — registry=${REGISTRY_ID.slice(0, 8)}… repayment=${REPAYMENT_ID.slice(0, 8)}…`);
  log(`scanning invoices in pages of ${PAGE_SIZE} (max ${MAX_PAGES} pages)`);

  let offset = 0;
  let scanned = 0;
  let marked = 0;
  let bumped = 0;
  let pages = 0;

  while (pages < MAX_PAGES) {
    const page = await readInvoicePage(offset, pub);
    if (page.length === 0) break;
    scanned += page.length;
    pages += 1;

    const now = Math.floor(Date.now() / 1000);
    for (const raw of page) {
      const inv = raw as Record<string, unknown>;
      const id = String(inv.id);
      const st = statusNum(inv.status);
      const due = Number(inv.due_date);
      const active = st === 0 /* Pending */ || st === 1 /* Financed */;

      if (st === 1 && due < now) {
        log(`[overdue] ${id} due=${due} now=${now} → mark_overdue`);
        if (await markOverdue(id, kp)) marked += 1;
      }

      if (active && bumped < MAX_TTL_BUMPS) {
        log(`[ttl] ${id} (status=${st}) → extend ${TTL_EXTEND_LEDGERS} ledgers`);
        if (await bumpTtl(id, kp)) bumped += 1;
      }
    }

    if (page.length < PAGE_SIZE) break;
    offset += page.length;
  }

  log(`summary: pages=${pages} scanned=${scanned} marked_overdue=${marked} ttl_bumps=${bumped}`);
  if (scanned === 0) log('no invoices found — nothing to do (this is fine on a fresh deployment)');
}

main()
  .then(() => {
    log('keeper run complete');
    process.exit(0);
  })
  .catch((err: unknown) => {
    log(`keeper run FAILED: ${(err as Error).message}`);
    process.exit(1);
  });
