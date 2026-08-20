// ── SDK input validation (fast-fail client boundary) ─────────────────────────
//
// Every SDK method validates its arguments here before any RPC call is made.
// Error codes mirror the convention used in invofi-contracts#107 so library
// consumers can programmatically match errors without string-parsing.
//
// Usage:
//   import { validate, SdkValidationError } from './validation';
//   validate.stellarAddress(address, 'originatorAddress');
//   validate.positiveI128(amount, 'amount');

// ── Error codes ───────────────────────────────────────────────────────────────
// Aligned with invofi-contracts#107 error-code conventions.

export const ErrorCode = {
  // Generic field errors
  MISSING_FIELD:       'MISSING_FIELD',
  INVALID_TYPE:        'INVALID_TYPE',

  // Address / identity
  INVALID_ADDRESS:     'INVALID_ADDRESS',

  // Numeric / amount
  INVALID_AMOUNT:      'INVALID_AMOUNT',     // non-positive amount
  INVALID_RATE:        'INVALID_RATE',       // interest rate out of range
  INVALID_DURATION:    'INVALID_DURATION',   // duration <= 0

  // Timestamps
  INVALID_DUE_DATE:    'INVALID_DUE_DATE',   // due date not in the future

  // Identifiers (invoice id, offer id, token id)
  INVALID_ID:          'INVALID_ID',

  // Asset / token
  INVALID_ASSET:       'INVALID_ASSET',      // bad "CODE:ISSUER" format
  INVALID_CURRENCY:    'INVALID_CURRENCY',   // not XLM | USDC

  // Config
  MISSING_CONFIG:      'MISSING_CONFIG',     // required config field absent
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

// ── Typed error class ─────────────────────────────────────────────────────────

export class SdkValidationError extends Error {
  readonly code: ErrorCode;
  readonly field: string;

  constructor(code: ErrorCode, field: string, message: string) {
    super(message);
    this.name = 'SdkValidationError';
    this.code = code;
    this.field = field;
    // Maintain proper prototype chain for compiled ES5 targets
    Object.setPrototypeOf(this, SdkValidationError.prototype);
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Stellar public-key / contract-ID format: G… or C… — 56 base-32 characters.
 * Stellar base32 uses A-Z and digits 2-7 only (no 0, 1, 8, 9).
 */
const STELLAR_ADDRESS_RE = /^[GC][A-Z2-7]{55}$/;

/**
 * Minimum invoice amount: 1 stroop (10^-7 XLM / USDC unit).
 * Must match invofi-registry's `MIN_INVOICE_AMOUNT` constant.
 */
export const MIN_AMOUNT = 1n;

/**
 * Maximum interest rate in basis points: 10 000 bp = 100%.
 * Mirrors invofi-financing's upper guard.
 */
export const MAX_INTEREST_RATE_BPS = 10_000;

/**
 * Maximum offer duration in seconds: 365 days.
 * Mirrors invofi-financing's `MAX_OFFER_DURATION_SECS`.
 */
export const MAX_DURATION_SECS = 365 * 24 * 60 * 60;

/**
 * Valid currencies accepted by the protocol.
 */
export const VALID_CURRENCIES = new Set(['XLM', 'USDC'] as const);

// ── Internal helper ───────────────────────────────────────────────────────────

function fail(code: ErrorCode, field: string, msg: string): never {
  throw new SdkValidationError(code, field, msg);
}

// ── Validation functions ──────────────────────────────────────────────────────
// Declared as standalone functions (not object method shorthand) so that
// TypeScript's strict `asserts` typing (TS2775) is satisfied correctly.

/**
 * Validates a Stellar account (G…) or contract (C…) address.
 */
export function validateStellarAddress(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(ErrorCode.INVALID_ADDRESS, field, `${field}: expected a non-empty Stellar address string`);
  }
  if (!STELLAR_ADDRESS_RE.test(value)) {
    fail(
      ErrorCode.INVALID_ADDRESS,
      field,
      `${field}: "${value.slice(0, 10)}…" is not a valid Stellar address (expected G… or C… with 56 base-32 characters)`,
    );
  }
}

/**
 * Validates that a bigint amount is positive (≥ MIN_AMOUNT stroops).
 */
export function validatePositiveI128(value: unknown, field: string): asserts value is bigint {
  if (typeof value !== 'bigint') {
    fail(ErrorCode.INVALID_AMOUNT, field, `${field}: expected a bigint, got ${typeof value}`);
  }
  if (value < MIN_AMOUNT) {
    fail(
      ErrorCode.INVALID_AMOUNT,
      field,
      `${field}: amount must be ≥ ${MIN_AMOUNT} stroop (got ${value})`,
    );
  }
}

/**
 * Validates interest rate in basis points: 1–10 000 (0.01 % – 100 %).
 */
export function validateInterestRate(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    fail(ErrorCode.INVALID_RATE, field, `${field}: interest rate must be an integer number of basis points`);
  }
  if (value < 1 || value > MAX_INTEREST_RATE_BPS) {
    fail(
      ErrorCode.INVALID_RATE,
      field,
      `${field}: interest rate must be between 1 and ${MAX_INTEREST_RATE_BPS} basis points (got ${value})`,
    );
  }
}

/**
 * Validates offer duration in seconds: 1 – MAX_DURATION_SECS.
 */
export function validateDuration(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    fail(ErrorCode.INVALID_DURATION, field, `${field}: duration must be an integer number of seconds`);
  }
  if (value < 1 || value > MAX_DURATION_SECS) {
    fail(
      ErrorCode.INVALID_DURATION,
      field,
      `${field}: duration must be between 1 and ${MAX_DURATION_SECS} seconds (got ${value})`,
    );
  }
}

/**
 * Validates a Unix timestamp (in seconds) is strictly in the future.
 */
export function validateFutureTimestamp(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    fail(ErrorCode.INVALID_DUE_DATE, field, `${field}: due date must be an integer Unix timestamp (seconds)`);
  }
  const nowSecs = Math.floor(Date.now() / 1000);
  if (value <= nowSecs) {
    fail(
      ErrorCode.INVALID_DUE_DATE,
      field,
      `${field}: due date must be in the future (got ${value}, current time ${nowSecs})`,
    );
  }
}

/**
 * Validates a non-empty, printable symbol / ID string.
 * Mirrors Soroban Symbol type: ≤ 32 ASCII alphanumeric/underscore chars.
 */
export function validateSymbolId(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(ErrorCode.INVALID_ID, field, `${field}: expected a non-empty string identifier`);
  }
  if (value.length > 32) {
    fail(ErrorCode.INVALID_ID, field, `${field}: identifier exceeds 32 characters (got ${value.length})`);
  }
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    fail(
      ErrorCode.INVALID_ID,
      field,
      `${field}: identifier must only contain letters, digits, or underscores (got "${value}")`,
    );
  }
}

/**
 * Validates currency is one of the protocol-supported values: XLM | USDC.
 */
export function validateCurrency(value: unknown, field: string): asserts value is 'XLM' | 'USDC' {
  if (typeof value !== 'string' || !VALID_CURRENCIES.has(value as 'XLM' | 'USDC')) {
    fail(
      ErrorCode.INVALID_CURRENCY,
      field,
      `${field}: currency must be one of ${[...VALID_CURRENCIES].join(' | ')} (got "${value}")`,
    );
  }
}

/**
 * Validates a "CODE:ISSUER" position-token asset string.
 */
export function validateAssetString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(ErrorCode.INVALID_ASSET, field, `${field}: expected a non-empty asset string`);
  }
  const parts = value.split(':');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    fail(
      ErrorCode.INVALID_ASSET,
      field,
      `${field}: asset must be in "CODE:ISSUER" format (got "${value}")`,
    );
  }
  if (!STELLAR_ADDRESS_RE.test(parts[1])) {
    fail(
      ErrorCode.INVALID_ASSET,
      field,
      `${field}: asset issuer "${parts[1].slice(0, 10)}…" is not a valid Stellar address`,
    );
  }
}

/**
 * Validates that a required config field is present and non-empty.
 */
export function validateConfigField(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(
      ErrorCode.MISSING_CONFIG,
      field,
      `${field}: required configuration field is missing or empty`,
    );
  }
}

// ── Convenience namespace ─────────────────────────────────────────────────────
// Re-export as a `validate.*` namespace so call sites read naturally.

export const validate = {
  stellarAddress:   validateStellarAddress,
  positiveI128:     validatePositiveI128,
  interestRate:     validateInterestRate,
  duration:         validateDuration,
  futureTimestamp:  validateFutureTimestamp,
  symbolId:         validateSymbolId,
  currency:         validateCurrency,
  assetString:      validateAssetString,
  configField:      validateConfigField,
};
