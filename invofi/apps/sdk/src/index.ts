// @invofi/sdk — typed client for the InvoFi protocol (Task 15)
//
// The SDK is framework-agnostic: it takes a Stellar RPC URL, the three
// protocol contract IDs, and a `signTransaction` callback. Use it from any
// TypeScript environment (React/Next.js frontends, scripts, bots).
//
// The frontend binds it once in `apps/frontend/src/lib/contract.ts` and
// re-exports the typed methods — no contract-call code is duplicated there.

export { createInvofiClient, type InvofiClient } from './client';
export { createUpgradeClient, type UpgradeClient, type DetectedVersion, type UpgradeNotification } from './upgrade';
export {
  parseSemVer,
  serializeSemVer,
  compareVersions,
  isNewerVersion,
  isMajorUpgrade,
  getCompatibilityStatus,
  areVersionsCompatible,
  lookupCompatibility,
  COMPATIBILITY_MATRIX,
  type SemVer,
  type VersionedContract,
  type CompatibilityStatus,
  type CompatibilityEntry,
  type MigrationStep,
  type MigrationPlan,
  type RollbackPlan,
} from './version';
export type { InvofiClientConfig } from './config';
export type { Currency, FinancingOffer, Invoice, InvoiceStatus, OfferStatus } from './types';

// Stellar primitives the client surface needs — re-exported so consumers
// don't need a direct @stellar/stellar-sdk dependency for common cases.
export { Contract, Networks, xdr, nativeToScVal, scValToNative } from '@stellar/stellar-sdk';
