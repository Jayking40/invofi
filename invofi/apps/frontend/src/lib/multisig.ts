// ── Multi-signature transaction approval (issue #219) ────────────────────────
// High-value operations don't submit on a single signature. Instead the app
// builds ONE base transaction envelope, stores it in `pending_transactions`,
// and each co-signer signs that same envelope with their wallet. Every
// signature is stored as a `transaction_approvals` row; once the required
// number is collected they are combined onto the envelope and submitted.
//
// This is account-level Stellar multi-sig (a source account whose signing
// weight is split across N keys) — the canonical "collect signatures, then
// submit" pattern that maps directly to how classic Stellar transactions are
// authorised. It is deliberately transaction-agnostic: the queue coordinates
// any base XDR, so the same machinery covers treasury payments today and
// widens later. See docs/adr/0006-multisig-transaction-approval.md for scope
// (Soroban per-address auth is a separate, larger effort) and the trade-offs.
import {
  Asset,
  Horizon,
  Operation,
  Transaction,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { supabase } from './supabase';
import { NETWORK_PASSPHRASE, signTransactionWithActiveWallet } from './walletkit';
import {
  HORIZON_URL,
  MULTISIG_NOTIFY_WEBHOOK_URL,
  MULTISIG_REQUIRED_SIGNATURES,
  MULTISIG_THRESHOLDS,
  MULTISIG_TIMEOUT_SECS,
  USDC_ISSUER_TESTNET,
} from './constants';
import { amountToStroops, toStroopsBigInt } from './utils';
import type {
  Currency,
  PendingTransaction,
  PendingTransactionStatus,
  PendingTransactionWithApprovals,
  TransactionApproval,
} from '@/types';

const BASE_FEE = '100';

// ── Threshold logic (pure) ───────────────────────────────────────────────────

/** The multi-sig threshold for `currency`, in stroops. */
export function thresholdStroops(currency: Currency): bigint {
  return amountToStroops(String(MULTISIG_THRESHOLDS[currency] ?? 0));
}

/**
 * True when `amount` strictly exceeds the configured multi-sig threshold for
 * its currency. Accepts stroops (bigint) or a human-unit string/number — the
 * same dual convention as the rest of the app (see toStroopsBigInt).
 */
export function requiresMultisig(amount: string | bigint | number, currency: Currency): boolean {
  return toStroopsBigInt(amount) > thresholdStroops(currency);
}

/** Human-readable threshold for a currency, e.g. "10,000 XLM". */
export function formatThreshold(currency: Currency): string {
  return `${(MULTISIG_THRESHOLDS[currency] ?? 0).toLocaleString('en-US')} ${currency}`;
}

// ── Approval progress + expiry (pure) ────────────────────────────────────────

export interface ApprovalProgress {
  /** Distinct approvers who have signed. */
  received: number;
  /** Signatures required to execute. */
  required: number;
  /** How many more are needed (never negative). */
  remaining: number;
  /** 0..1, for a progress bar. */
  ratio: number;
  /** True once enough signatures are collected to submit. */
  thresholdMet: boolean;
  /** Distinct approver addresses, in first-seen order. */
  approvers: string[];
}

export function approvalProgress(
  tx: Pick<PendingTransaction, 'required_signatures'>,
  approvals: TransactionApproval[],
): ApprovalProgress {
  // Dedupe defensively; the DB unique constraint already prevents duplicates.
  const approvers = Array.from(new Set(approvals.map(a => a.approver_address)));
  const received = approvers.length;
  const required = Math.max(1, tx.required_signatures);
  return {
    received,
    required,
    remaining: Math.max(0, required - received),
    ratio: Math.min(1, received / required),
    thresholdMet: received >= required,
    approvers,
  };
}

export function isExpired(
  tx: Pick<PendingTransaction, 'expires_at'>,
  nowMs: number = Date.now(),
): boolean {
  const deadline = Date.parse(tx.expires_at);
  return Number.isFinite(deadline) && deadline <= nowMs;
}

/** Whole seconds until the approval window closes (0 once past). */
export function secondsUntilExpiry(
  tx: Pick<PendingTransaction, 'expires_at'>,
  nowMs: number = Date.now(),
): number {
  const deadline = Date.parse(tx.expires_at);
  if (!Number.isFinite(deadline)) return 0;
  return Math.max(0, Math.floor((deadline - nowMs) / 1000));
}

/**
 * The status to show a viewer, folding the 24h timeout into the stored value.
 * A `Pending` row past its deadline reads as `Expired` even before a sweep
 * writes that back — so no party can approve or execute an expired request.
 */
export function effectiveStatus(
  tx: Pick<PendingTransaction, 'status' | 'expires_at'>,
  nowMs: number = Date.now(),
): PendingTransactionStatus {
  if (tx.status === 'Executed' || tx.status === 'Rejected' || tx.status === 'Expired') {
    return tx.status;
  }
  return isExpired(tx, nowMs) ? 'Expired' : 'Pending';
}

// ── Signature extraction + combination (pure crypto) ─────────────────────────

/** Narrow a base64 XDR to a classic Transaction (fee-bumps are unsupported). */
function asTransaction(txXdr: string, passphrase: string): Transaction {
  const tx = TransactionBuilder.fromXDR(txXdr, passphrase);
  if ('innerTransaction' in tx) {
    throw new Error('Fee-bump transactions are not supported for multi-sig approval.');
  }
  return tx;
}

/**
 * The DecoratedSignatures present in `signedXdr` but not in `baseXdr`, base64
 * encoded — i.e. exactly what the wallet just added. Robust whether or not the
 * base envelope already carried signatures.
 */
export function extractNewSignatures(
  baseXdr: string,
  signedXdr: string,
  passphrase: string,
): string[] {
  const base = asTransaction(baseXdr, passphrase);
  const signed = asTransaction(signedXdr, passphrase);
  const seen = new Set(base.signatures.map(s => s.toXDR('base64')));
  return signed.signatures
    .map(s => s.toXDR('base64'))
    .filter(b64 => !seen.has(b64));
}

/**
 * Rebuild the base envelope and attach every collected signature, returning
 * the fully-signed XDR ready to submit. Duplicate signatures are ignored.
 */
export function combineSignatures(
  baseXdr: string,
  signaturesB64: string[],
  passphrase: string,
): string {
  const tx = asTransaction(baseXdr, passphrase);
  const present = new Set(tx.signatures.map(s => s.toXDR('base64')));
  for (const b64 of signaturesB64) {
    if (present.has(b64)) continue;
    tx.addDecoratedSignature(xdr.DecoratedSignature.fromXDR(b64, 'base64'));
    present.add(b64);
  }
  return tx.toXDR();
}

// ── Building a base transaction (treasury payment) ───────────────────────────

function assetFor(currency: Currency): Asset {
  if (currency === 'XLM') return Asset.native();
  // USDC on testnet. A mainnet deployment supplies its own issuer in a follow-up.
  return new Asset('USDC', USDC_ISSUER_TESTNET);
}

export interface BuildPaymentInput {
  /** Multi-sig source account (the account whose signers must approve). */
  source: string;
  destination: string;
  /** Human units, e.g. "12000.00". */
  amount: string;
  currency: Currency;
}

/**
 * Build an UNSIGNED payment envelope from `source`. The timebound spans the
 * full approval window so the envelope stays valid while signatures are
 * collected. Note: the sequence number is fixed at build time — the source
 * account must not submit other transactions while this request is pending
 * (see ADR-0006).
 */
export async function buildPaymentTransaction(input: BuildPaymentInput): Promise<string> {
  const horizon = new Horizon.Server(HORIZON_URL);
  const account = await horizon.loadAccount(input.source);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: input.destination,
        asset: assetFor(input.currency),
        amount: input.amount,
      }),
    )
    .setTimeout(MULTISIG_TIMEOUT_SECS)
    .build();
  return tx.toXDR();
}

// ── Supabase coordination ────────────────────────────────────────────────────

const SELECT_WITH_APPROVALS = '*, transaction_approvals(*)';

export interface CreatePendingTransactionInput {
  title: string;
  operation: string;
  xdr: string;
  amount: string;
  currency: Currency;
  initiator: string;
  initiatorId: string | null;
  requiredSignatures?: number;
  networkPassphrase?: string;
}

/** Queue a base transaction for M-of-N approval. */
export async function createPendingTransaction(
  input: CreatePendingTransactionInput,
): Promise<PendingTransactionWithApprovals> {
  const required = Math.max(2, Math.trunc(input.requiredSignatures ?? MULTISIG_REQUIRED_SIGNATURES));
  const expiresAt = new Date(Date.now() + MULTISIG_TIMEOUT_SECS * 1000).toISOString();

  const { data, error } = await supabase
    .from('pending_transactions')
    .insert({
      title: input.title,
      operation: input.operation,
      initiator: input.initiator,
      initiator_id: input.initiatorId,
      xdr: input.xdr,
      network_passphrase: input.networkPassphrase ?? NETWORK_PASSPHRASE,
      amount: input.amount,
      currency: input.currency,
      required_signatures: required,
      status: 'Pending',
      tx_hash: null,
      expires_at: expiresAt,
    })
    .select(SELECT_WITH_APPROVALS)
    .single();
  if (error) throw error;

  const row = data as unknown as PendingTransactionWithApprovals;
  row.transaction_approvals ??= [];
  void notifyCosigners(row, 'created');
  return row;
}

/** Every queued transaction, newest first, with approvals joined. */
export async function fetchPendingTransactions(): Promise<PendingTransactionWithApprovals[]> {
  const { data, error } = await supabase
    .from('pending_transactions')
    .select(SELECT_WITH_APPROVALS)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as PendingTransactionWithApprovals[]) ?? [];
}

export async function getPendingTransaction(
  id: string,
): Promise<PendingTransactionWithApprovals | null> {
  const { data, error } = await supabase
    .from('pending_transactions')
    .select(SELECT_WITH_APPROVALS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as PendingTransactionWithApprovals) ?? null;
}

export async function setPendingStatus(
  id: string,
  status: PendingTransactionStatus,
  txHash?: string,
): Promise<PendingTransaction> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (txHash !== undefined) patch.tx_hash = txHash;
  const { data, error } = await supabase
    .from('pending_transactions')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as PendingTransaction;
}

/**
 * Sign the base envelope with the connected wallet and record the approval.
 * The signature (a base64 DecoratedSignature) is stored in Supabase — never in
 * localStorage — so it survives page reloads and is visible to every party.
 */
export async function approvePendingTransaction(
  tx: PendingTransaction,
  approverAddress: string,
  approverId: string | null,
): Promise<TransactionApproval> {
  if (effectiveStatus(tx) === 'Expired') {
    throw new Error('This transaction has expired and can no longer be approved.');
  }
  if (tx.status !== 'Pending') {
    throw new Error(`This transaction is ${tx.status.toLowerCase()} and can no longer be approved.`);
  }

  const signedXdr = await signTransactionWithActiveWallet(tx.xdr, tx.network_passphrase);
  const newSignatures = extractNewSignatures(tx.xdr, signedXdr, tx.network_passphrase);
  if (newSignatures.length === 0) {
    throw new Error('Your wallet did not add a signature — approval was not recorded.');
  }

  const { data, error } = await supabase
    .from('transaction_approvals')
    .insert({
      pending_tx_id: tx.id,
      approver_address: approverAddress,
      approver_id: approverId,
      signature: newSignatures[0],
    })
    .select()
    .single();
  if (error) {
    // 23505 = unique_violation → this address already approved.
    if ((error as { code?: string }).code === '23505') {
      throw new Error('You have already approved this transaction.');
    }
    throw error;
  }

  void notifyCosigners(tx, 'approved');
  return data as unknown as TransactionApproval;
}

/**
 * Combine the collected signatures onto the envelope and submit it to the
 * network via Horizon. Throws if the approval threshold isn't met yet.
 */
export async function executePendingTransaction(
  tx: PendingTransactionWithApprovals,
): Promise<PendingTransaction> {
  if (tx.status === 'Executed') throw new Error('This transaction has already executed.');
  if (effectiveStatus(tx) === 'Expired') {
    throw new Error('This transaction has expired and can no longer be executed.');
  }
  const progress = approvalProgress(tx, tx.transaction_approvals);
  if (!progress.thresholdMet) {
    throw new Error(
      `Need ${progress.required} approvals to execute — only ${progress.received} collected.`,
    );
  }

  const signedXdr = combineSignatures(
    tx.xdr,
    tx.transaction_approvals.map(a => a.signature),
    tx.network_passphrase,
  );
  const finalTx = asTransaction(signedXdr, tx.network_passphrase);

  const horizon = new Horizon.Server(HORIZON_URL);
  const result = await horizon.submitTransaction(finalTx);
  const hash = (result as { hash?: string }).hash ?? '';
  return setPendingStatus(tx.id, 'Executed', hash);
}

/**
 * Best-effort timeout sweep: mark any `Pending` row past its deadline as
 * `Expired`. Runs whenever a client loads the queue. The authoritative,
 * always-on sweep belongs in the keeper (a scheduled GitHub Action) — until
 * then {@link effectiveStatus} already hides expired rows from every action,
 * so a missed sweep never lets a stale transaction execute.
 */
export async function expireStale(rows: PendingTransaction[]): Promise<string[]> {
  const now = Date.now();
  const stale = rows.filter(r => r.status === 'Pending' && isExpired(r, now));
  const expired: string[] = [];
  for (const row of stale) {
    try {
      await setPendingStatus(row.id, 'Expired');
      expired.push(row.id);
    } catch {
      // A client without update rights simply sees Expired via effectiveStatus().
    }
  }
  return expired;
}

// ── Co-signer notification ───────────────────────────────────────────────────

/**
 * Notify co-signers a transaction was queued or approved by POSTing to a
 * configured webhook. No-op when unset (the default no-backend deployment).
 *
 * Email can't be sent from the browser, so delivery lives behind this webhook:
 * point it at a Supabase Edge Function that fans out to email/Slack. The
 * webhook origin must also be allowlisted in `connect-src` (next.config.mjs).
 * Always best-effort — a notification failure never blocks the on-chain flow.
 */
export async function notifyCosigners(
  tx: PendingTransaction,
  event: 'created' | 'approved',
): Promise<void> {
  if (!MULTISIG_NOTIFY_WEBHOOK_URL) return;
  try {
    await fetch(MULTISIG_NOTIFY_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        transaction: {
          id: tx.id,
          title: tx.title,
          operation: tx.operation,
          amount: tx.amount,
          currency: tx.currency,
          initiator: tx.initiator,
          required_signatures: tx.required_signatures,
          expires_at: tx.expires_at,
        },
      }),
    });
  } catch {
    // Best-effort only.
  }
}
