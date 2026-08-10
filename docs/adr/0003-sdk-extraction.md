# ADR-0003: SDK extraction (@invofi/sdk)

**Status:** Accepted (2026-08-06)

## Context

All contract-call logic (encoding, simulate/sign/submit, parsing) lived inside
`apps/frontend/src/lib/contract.ts`. That couples the frontend to the contract
ABI and makes the protocol's client unusable from scripts, bots, or a future
mobile app. The SDK extraction resolves that.

## Decision

1. **New package `apps/sdk` (`@invofi/sdk`)** owns every Soroban contract call:
   registry (register/get/cancel), financing (create/get/accept/reject),
   repayment (repay/mark-overdue/reclaim), and position tokens
   (get-token-id/balance/decimals/transfer + trustline helpers).
2. **Framework-agnostic.** The SDK has no React, Next.js, or wallet imports.
   Callers inject `signTransaction(txXdr, networkPassphrase)` plus the
   contract IDs and RPC endpoints via `createInvofiClient(config)`.
3. **One binding point.** `apps/frontend/src/lib/contract.ts` is now a thin
   adapter: it builds the client from env vars + the wallet-kit signer and
   re-exports the typed methods. Components keep their existing imports; no
   duplicate contract-call code remains in the frontend.
4. **Types move too.** `Invoice`, `FinancingOffer`, `Currency`, and status
   unions live in the SDK and are re-exported by the frontend — one source of
   truth for contract shapes.
5. **Not published yet.** npm publishing is a fast follow once the ABI is
   stable (contract IDs finalized); the package is consumed internally
   via a TypeScript path alias.

## Consequences

- Frontend contract.ts shrinks from ~300 lines of logic to a ~40-line binding.
- New consumers (keeper, indexer, bots) can reuse the same typed client.
- The SDK's `readContract` uses a friendbot-funded read account on testnet —
  fixing the old "throw-away account" pattern that failed reads when the
  account didn't exist in the ledger.
