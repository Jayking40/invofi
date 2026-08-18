// ── SDK typed error handling & Soroban error code mapping (#223) ────────────
//
// Every RPC-facing failure in client.ts (simulation failure, submit failure,
// non-SUCCESS transaction status) is funneled through `parseContractError`
// so callers get a typed `ContractError` with a stable `.errorType`, a
// human-readable `.message`, an optional `.recovery` suggestion, and the
// original failure preserved as `.cause` — instead of a plain `new Error(...)`
// with an interpolated string that can only be handled by matching text.
//
// ⚠️  IMPORTANT — PLACEHOLDER ERROR CODES ⚠️
// The numeric codes in `CONTRACT_ERROR_MAP` below are illustrative starter
// values inferred from this SDK's own method surface (client.ts) and
// validation constants (validation.ts). They are NOT sourced from the real
// `common/src/errors.rs` enum in the `Stellar-VaultLink/invofi-contracts`
// repository — that repo is a separate codebase not available in this
// workspace. The numeric ordering of a Rust `#[contracterror]` enum is
// whatever `common/src/errors.rs` declares, and Soroban error codes are
// positional (first variant = 1, second = 2, ...), so a mismatch here would
// silently mislabel real on-chain errors. Before this ships against a
// network where the real contracts are live, a maintainer MUST reconcile
// every entry in `CONTRACT_ERROR_MAP` against `common/src/errors.rs` and
// correct the numeric codes (and add any missing variants) accordingly.
//
// Usage:
//   import { parseContractError, ContractError, ContractErrorType } from './errors';
//   try { ... } catch (err) { throw parseContractError(err); }

// ── Recovery suggestions ─────────────────────────────────────────────────────

/**
 * A user-facing hint for how to recover from a given error, surfaced by
 * consumers (e.g. the frontend's `SdkErrorBoundary`) alongside the error
 * message.
 */
export interface RecoverySuggestion {
  /** Human-readable recovery hint, e.g. "Fund your wallet with more XLM." */
  message: string;
  /** Optional short action label for a UI button, e.g. "Add funds". */
  action?: string;
  /** Optional URL for more information (docs, faucet, support). */
  url?: string;
}

// ── Base SDK error ───────────────────────────────────────────────────────────

/**
 * Base class for all errors thrown by @invofi/sdk beyond input validation
 * (see `SdkValidationError` in validation.ts for pre-RPC argument checks).
 *
 * Supports error chaining (contract error → SDK error → UI error): pass the
 * originating error as `cause` and it is preserved for callers that want to
 * inspect the full failure chain (e.g. `err.cause`).
 *
 * Note: this SDK targets ES2020 (see tsconfig.json), which predates the
 * ES2022 `Error` `cause` option in TypeScript's lib types. We therefore
 * carry our own `cause` field and wire it through manually rather than
 * relying on `super(message, { cause })`.
 */
export class SdkError extends Error {
  /** The original error this one was constructed from, if any. */
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'SdkError';
    this.cause = cause;
    // Maintain proper prototype chain for compiled ES5 targets.
    Object.setPrototypeOf(this, SdkError.prototype);
  }
}

// ── Contract error codes ─────────────────────────────────────────────────────
// `const` object + derived union type, mirroring the `ErrorCode` convention
// in validation.ts. One entry per mapped Soroban contract error, plus
// UNKNOWN for anything not (yet) in CONTRACT_ERROR_MAP.

export const ContractErrorType = {
  // ── Invoice lifecycle (registry contract) ──────────────────────────────────
  INVOICE_NOT_FOUND:          'INVOICE_NOT_FOUND',
  INVOICE_ALREADY_CANCELLED:  'INVOICE_ALREADY_CANCELLED',
  INVALID_STATUS_TRANSITION:  'INVALID_STATUS_TRANSITION',

  // ── Financing offers (financing contract) ──────────────────────────────────
  OFFER_NOT_FOUND:            'OFFER_NOT_FOUND',
  OFFER_EXPIRED:               'OFFER_EXPIRED',
  OFFER_ALREADY_ACCEPTED:      'OFFER_ALREADY_ACCEPTED',
  OFFER_ALREADY_REJECTED:      'OFFER_ALREADY_REJECTED',
  INTEREST_RATE_OUT_OF_RANGE:  'INTEREST_RATE_OUT_OF_RANGE',
  DURATION_OUT_OF_RANGE:       'DURATION_OUT_OF_RANGE',

  // ── Repayment / reclaim (repayment contract) ────────────────────────────────
  ALREADY_REPAID:              'ALREADY_REPAID',
  INSUFFICIENT_BALANCE:        'INSUFFICIENT_BALANCE',
  NOT_YET_OVERDUE:              'NOT_YET_OVERDUE',
  GRACE_PERIOD_NOT_ELAPSED:    'GRACE_PERIOD_NOT_ELAPSED',

  // ── Position tokens ──────────────────────────────────────────────────────────
  NO_TRUSTLINE:                 'NO_TRUSTLINE',

  // ── Cross-cutting ─────────────────────────────────────────────────────────────
  UNAUTHORIZED:                 'UNAUTHORIZED',

  // ── Fallback ───────────────────────────────────────────────────────────────────
  UNKNOWN:                      'UNKNOWN',
} as const;

export type ContractErrorType = typeof ContractErrorType[keyof typeof ContractErrorType];

// ── Contract error → typed mapping table ─────────────────────────────────────
//
// ⚠️  PLACEHOLDER / STARTER SET — see the file-level banner above. The
// numeric `code` values here are illustrative guesses at positional
// `#[contracterror]` ordering and MUST be reconciled against the real
// `common/src/errors.rs` in `Stellar-VaultLink/invofi-contracts` before
// relying on them against live contracts. Treat this table as the single
// place to update once the real codes are known — it is trivially
// extensible: add a `{ type, message, recovery }` entry keyed by the real
// numeric code.

interface ContractErrorEntry {
  type: ContractErrorType;
  message: string;
  recovery?: RecoverySuggestion;
}

export const CONTRACT_ERROR_MAP: Record<number, ContractErrorEntry> = {
  1: {
    type: ContractErrorType.INVOICE_NOT_FOUND,
    message: 'No invoice was found with the given ID.',
    recovery: { message: 'Double-check the invoice ID and that it was registered successfully.' },
  },
  2: {
    type: ContractErrorType.INVOICE_ALREADY_CANCELLED,
    message: 'This invoice has already been cancelled and cannot be modified.',
    recovery: { message: 'Register a new invoice if you need to submit these terms again.' },
  },
  3: {
    type: ContractErrorType.INVALID_STATUS_TRANSITION,
    message: 'This action is not valid for the invoice/offer in its current status.',
    recovery: { message: 'Refresh the invoice/offer status and confirm the action is still applicable.' },
  },
  4: {
    type: ContractErrorType.OFFER_NOT_FOUND,
    message: 'No financing offer was found with the given ID.',
    recovery: { message: 'Double-check the offer ID and that it was created successfully.' },
  },
  5: {
    type: ContractErrorType.OFFER_EXPIRED,
    message: 'This financing offer has expired and can no longer be accepted.',
    recovery: { message: 'Ask the lender to submit a new offer.' },
  },
  6: {
    type: ContractErrorType.OFFER_ALREADY_ACCEPTED,
    message: 'This financing offer has already been accepted.',
    recovery: { message: 'Refresh the offer status — no further action is needed.' },
  },
  7: {
    type: ContractErrorType.OFFER_ALREADY_REJECTED,
    message: 'This financing offer has already been rejected.',
    recovery: { message: 'Ask the lender to submit a new offer if terms are still needed.' },
  },
  8: {
    type: ContractErrorType.INTEREST_RATE_OUT_OF_RANGE,
    message: 'The requested interest rate is outside the protocol-allowed range.',
    recovery: { message: 'Use an interest rate between 1 and 10,000 basis points (0.01%–100%).' },
  },
  9: {
    type: ContractErrorType.DURATION_OUT_OF_RANGE,
    message: 'The requested offer duration is outside the protocol-allowed range.',
    recovery: { message: 'Use a duration between 1 second and 365 days.' },
  },
  10: {
    type: ContractErrorType.ALREADY_REPAID,
    message: 'This invoice has already been fully repaid.',
    recovery: { message: 'Refresh the invoice status — no further repayment is needed.' },
  },
  11: {
    type: ContractErrorType.INSUFFICIENT_BALANCE,
    message: 'The account does not have sufficient balance to complete this transaction.',
    recovery: { message: 'Add funds to your wallet and try again.', action: 'Add funds' },
  },
  12: {
    type: ContractErrorType.NOT_YET_OVERDUE,
    message: 'This invoice is not yet past its due date and cannot be marked overdue.',
    recovery: { message: 'Wait until the due date has passed before calling this again.' },
  },
  13: {
    type: ContractErrorType.GRACE_PERIOD_NOT_ELAPSED,
    message: 'The overdue grace period has not yet elapsed, so this invoice cannot be reclaimed.',
    recovery: { message: 'Wait for the grace period to elapse before reclaiming.' },
  },
  14: {
    type: ContractErrorType.NO_TRUSTLINE,
    message: 'The recipient does not have a trustline for the position token.',
    recovery: {
      message: 'Add a trustline for the position token asset before this transfer/mint can succeed.',
      action: 'Add trustline',
    },
  },
  15: {
    type: ContractErrorType.UNAUTHORIZED,
    message: 'The calling address is not authorized to perform this action.',
    recovery: { message: 'Sign this transaction with the address that owns/originated this resource.' },
  },
};

// ── Analytics hook (opt-in, dependency-free) ─────────────────────────────────
//
// Consuming apps can opt in to reporting SDK errors to their own analytics/
// observability pipeline without the SDK taking a dependency on any specific
// analytics package. No-op until `setErrorReporter` is called.

let errorReporter: ((err: SdkError) => void) | undefined;

/**
 * Register a callback invoked with every `SdkError` (including
 * `ContractError`) constructed via `parseContractError`. Optional — if never
 * called, no reporting happens. Pass `undefined` to unregister.
 */
export function setErrorReporter(fn: ((err: SdkError) => void) | undefined): void {
  errorReporter = fn;
}

/** Internal: report an error to the registered reporter, if any. Never throws. */
function reportError(err: SdkError): void {
  if (!errorReporter) return;
  try {
    errorReporter(err);
  } catch {
    // Reporting must never break the caller's error-handling flow.
  }
}

// ── Contract error ────────────────────────────────────────────────────────────

/**
 * A typed error representing a failed Soroban contract call — simulation
 * failure, submit failure, or a transaction that did not reach SUCCESS
 * status. Constructed by `parseContractError`.
 */
export class ContractError extends SdkError {
  /** The raw numeric Soroban contract error code, or -1 if none could be extracted. */
  readonly rawCode: number;
  /** The typed classification of this error (UNKNOWN if rawCode is unmapped). */
  readonly errorType: ContractErrorType;
  /** Optional recovery suggestion for this error type. */
  readonly recovery?: RecoverySuggestion;

  constructor(rawCode: number, errorType: ContractErrorType, message: string, recovery?: RecoverySuggestion, cause?: unknown) {
    super(message, cause);
    this.name = 'ContractError';
    this.rawCode = rawCode;
    this.errorType = errorType;
    this.recovery = recovery;
    // Maintain proper prototype chain for compiled ES5 targets.
    Object.setPrototypeOf(this, ContractError.prototype);
  }
}

// ── Error code extraction & mapping ──────────────────────────────────────────

/**
 * Soroban simulation/transaction failures typically stringify as something
 * like `HostError: Error(Contract, #4)` or embed `Error(Contract, #4)`
 * within a larger JSON/diagnostic payload. This pattern extracts the
 * trailing `#<N>` contract error code from any such string.
 */
const CONTRACT_ERROR_CODE_RE = /Error\(Contract,\s*#(\d+)\)/;
/** Fallback: a bare `#<N>` anywhere in the string. */
const BARE_ERROR_CODE_RE = /#(\d+)/;

/** Best-effort extraction of a raw error message string from an unknown thrown value. */
function stringifyRawError(rawError: unknown): string {
  if (typeof rawError === 'string') return rawError;
  if (rawError instanceof Error) return rawError.message;
  if (rawError && typeof rawError === 'object') {
    try {
      return JSON.stringify(rawError);
    } catch {
      return String(rawError);
    }
  }
  return String(rawError);
}

/** Extracts a numeric Soroban contract error code from a raw error value, if present. */
function extractErrorCode(rawError: unknown): number | undefined {
  const text = stringifyRawError(rawError);
  const match = CONTRACT_ERROR_CODE_RE.exec(text) ?? BARE_ERROR_CODE_RE.exec(text);
  if (!match) return undefined;
  const code = Number(match[1]);
  return Number.isFinite(code) ? code : undefined;
}

/**
 * Parses a raw error (as thrown/returned by a failed `simulateTransaction`,
 * `sendTransaction`, or `getTransaction` call) into a typed `ContractError`.
 *
 * - Extracts a numeric Soroban error code (`Error(Contract, #N)`) when present.
 * - Looks it up in `CONTRACT_ERROR_MAP`; unmapped codes fall back to
 *   `ContractErrorType.UNKNOWN` with the raw code preserved.
 * - When no code can be extracted at all, falls back to `UNKNOWN` with
 *   `rawCode: -1`, preserving the original message.
 * - Always attaches the original `rawError` as `.cause` for chaining.
 * - Reports the constructed error via the opt-in analytics hook.
 *
 * This never throws — it always returns a `ContractError` for the caller to throw.
 */
export function parseContractError(rawError: unknown, contextMessage?: string): ContractError {
  const originalMessage = stringifyRawError(rawError);
  const code = extractErrorCode(rawError);

  if (code !== undefined && code in CONTRACT_ERROR_MAP) {
    const entry = CONTRACT_ERROR_MAP[code];
    const message = contextMessage ? `${contextMessage}: ${entry.message}` : entry.message;
    const err = new ContractError(code, entry.type, message, entry.recovery, rawError);
    reportError(err);
    return err;
  }

  const fallbackMessage = contextMessage
    ? `${contextMessage}: ${originalMessage}`
    : `Contract call failed: ${originalMessage}`;
  const err = new ContractError(code ?? -1, ContractErrorType.UNKNOWN, fallbackMessage, undefined, rawError);
  reportError(err);
  return err;
}
