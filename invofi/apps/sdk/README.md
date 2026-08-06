# @invofi/sdk

Typed TypeScript client for the **InvoFi** protocol (Task 15). It owns every
Soroban contract call — invoice registration, offers, acceptance/repayment,
position tokens, and trustlines — so the frontend and any future consumers
share one implementation instead of each holding a private copy.

> **Not published yet.** Consumed internally by `apps/frontend`; publishing to
> npm is a fast follow once the ABI is stable (Task 6 done).

## Design

- **Framework-agnostic** — no React, no Next.js, no wallet imports. The
  consumer injects a `signTransaction(txXdr, networkPassphrase)` callback so
  the SDK works with Freighter, LOBSTR, xBull, or anything else behind that
  one function.
- **Single source of truth for types** — `Invoice`, `FinancingOffer`,
  `Currency`, and status unions live here and are re-exported by the frontend.
- **One binding point** — `apps/frontend/src/lib/contract.ts` configures the
  client once (contract IDs + the active wallet signer) and re-exports the
  typed methods. No duplicate contract-call code remains in the frontend.

## Usage

```ts
import { createInvofiClient, Networks } from '@invofi/sdk';
import { signTransactionWithActiveWallet } from './your-wallet';

const invofi = createInvofiClient({
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  networkPassphrase: Networks.TESTNET,
  registryId: 'C…',
  financingId: 'C…',
  repaymentId: 'C…',
  positionTokenAsset: 'POS:GBDD…', // for trustline helpers
  signTransaction: signTransactionWithActiveWallet,
});

const invoice = await invofi.getInvoice('inv_001');
await invofi.acceptOffer('off_001', originatorAddress);
```

## API surface

| Method | Contract | Notes |
|---|---|---|
| `registerInvoice(params, originator)` | registry | emits `inv_reg` |
| `getInvoice(id)` / `cancelInvoice(id, originator)` | registry | `inv_cxl` on cancel |
| `createOffer(params, lender)` | financing | `off_new` |
| `getOffer(id)` / `acceptOffer(id, originator)` / `rejectOffer(id, originator)` | financing | `off_acc` / `off_rej` |
| `repayInvoice(invoiceId, offerId, repayer, amount)` | repayment | `inv_rep` |
| `markOverdue(invoiceId, caller)` | repayment | `inv_ovd` |
| `reclaimInvoice(invoiceId, offerId, lender)` | repayment | default path |
| `getPositionTokenId()` / `getTokenBalance()` / `getTokenDecimals()` | financing + token | Task 7/8 |
| `transferPositionToken(tokenId, from, to, amount)` | token (SEP-41) | Task 8 |
| `hasPositionTrustline(addr)` / `addPositionTrustline(addr)` | Horizon | POS trustline support |

Read-only calls accept an optional `sourceAccount` (the connected wallet);
when omitted they fall back to a fixed read account that is funded on testnet,
so reads never fail because a throw-away account doesn't exist in the ledger.

## Local dev

```bash
cd invofi/apps/sdk
npm install
npm run type-check
```
