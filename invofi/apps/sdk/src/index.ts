// @invofi/sdk — typed client for the InvoFi protocol (Task 15)
//
// The SDK is framework-agnostic: it takes a Stellar RPC URL, the three
// protocol contract IDs, and a `signTransaction` callback. Use it from any
// TypeScript environment (React/Next.js frontends, scripts, bots).
//
// The frontend binds it once in `apps/frontend/src/lib/contract.ts` and
// re-exports the typed methods — no contract-call code is duplicated there.

export { createInvofiClient, type InvofiClient, SdkValidationError, ErrorCode } from './client';
export type { InvofiClientConfig } from './config';
export type { Currency, FinancingOffer, Invoice, InvoiceStatus, OfferStatus } from './types';

// Validation helpers re-exported for consumers who want to pre-validate
// before calling SDK methods (e.g. form-level validation in the frontend).
export { validate, type ErrorCode as ValidationErrorCode } from './validation';
export {
  MIN_AMOUNT,
  MAX_INTEREST_RATE_BPS,
  MAX_DURATION_SECS,
  VALID_CURRENCIES,
} from './validation';

// Stellar primitives the client surface needs — re-exported so consumers
// don't need a direct @stellar/stellar-sdk dependency for common cases.
export { Contract, Networks, xdr, nativeToScVal, scValToNative } from '@stellar/stellar-sdk';
