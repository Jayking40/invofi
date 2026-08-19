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

// ── Event stream (listenToEvents) ───────────────────────────────────────────
// Typed, polling-based event subscription for InvoFi protocol events.
// All 20 on-chain event types are covered with strongly-typed payloads.
//
// @example
// ```ts
// import { listenToEvents, Networks } from '@invofi/sdk';
//
// const stop = listenToEvents({
//   rpcUrl:            'https://soroban-testnet.stellar.org',
//   networkPassphrase: Networks.TESTNET,
//   contractIds:       [registryId, financingId, repaymentId],
//   eventTypes:        ['inv_reg', 'off_acc', 'inv_rep'],
//   onEvent(event) {
//     if (event.type === 'inv_reg') {
//       console.log('Invoice registered:', event.subjectId, event.data.originator);
//     }
//   },
//   onError(err) {
//     console.error('Event stream error:', err.message);
//   },
// });
//
// // Stop polling when done:
// stop();
// ```
export { listenToEvents } from './events';
export type {
  ProtocolEventName,
  ProtocolEvent,
  ListenToEventsOptions,
  StopListening,
  // Per-event payload types
  InvoiceRegisteredData,
  InvoiceAmountUpdatedData,
  InvoiceStatusUpdatedData,
  InvoiceCancelledData,
  InvoiceOverdueData,
  InvoiceDefaultedData,
  InvoiceDisputedData,
  InvoiceResolvedData,
  OfferCreatedData,
  OfferWithdrawnData,
  OfferAcceptedData,
  OfferRejectedData,
  OfferDefaultedData,
  PositionTokenMintedData,
  InvoiceRepaidData,
  PoolStakedData,
  PoolUnstakedData,
  PoolPayoutData,
  ReputationRecordedData,
} from './events';

// ── Offline cache (IndexedDB, stale-while-revalidate) ───────────────────────
// Browser-only, gracefully no-ops under SSR/Node (see cache.ts). Caches
// invoice/offer/position reads with configurable per-type TTLs and evicts
// least-recently-used entries once total cached size exceeds 50 MB.
// `createInvofiClient`'s state-changing methods (register/accept/reject/
// repay/etc.) call `invalidate()` internally on success, so consumers only
// need this surface for reads.
//
// The cache is namespaced per network + connected account (`CacheScope`) —
// `createInvofiClient` calls `setCacheScope` automatically from
// `cfg.networkPassphrase`/`cfg.accountAddress`, so switching wallets never
// serves one identity's cached data to another. On an explicit wallet
// disconnect, call `clearCache()` to wipe the departing account's store.
//
// @example
// ```ts
// import { staleWhileRevalidate, CACHE_TTL_MS } from '@invofi/sdk';
//
// const { data, isStale, refresh } = await staleWhileRevalidate(
//   `invoices:${status}:${page}`,
//   CACHE_TTL_MS.invoices,
//   () => client.listInvoices(status, page),
// );
// // Render `data` immediately (may be null/stale); `refresh` resolves once
// // the background re-fetch has silently updated the cache.
//
// // On wallet disconnect:
// await clearCache();
// ```
export {
  getCached,
  setCached,
  invalidate,
  clearCache,
  setCacheScope,
  getCacheScope,
  staleWhileRevalidate,
  isIndexedDbAvailable,
  CACHE_TTL_MS,
  MAX_CACHE_SIZE_BYTES,
} from './cache';
export type { CacheEntry, CacheScope, StaleWhileRevalidateResult } from './cache';
