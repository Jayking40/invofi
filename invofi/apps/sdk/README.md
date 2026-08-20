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

## Contract–SDK Method Mapping

| Contract Method | SDK Export |
|---|---|
| `register_invoice` | `registerInvoice` |
| `get_invoice` | `getInvoice` |
| `cancel_invoice` | `cancelInvoice` |
| `create_offer` | `createOffer` |
| `get_offer` | `getOffer` |
| `accept_offer` | `acceptOffer` |
| `reject_offer` | `rejectOffer` |
| `repay_invoice` | `repayInvoice` |
| `mark_overdue` | `markOverdue` |
| `reclaim_invoice` | `reclaimInvoice` |
| `get_position_token` | `getPositionTokenId` |
| `balance` | `getTokenBalance` |
| `decimals` | `getTokenDecimals` |
| `transfer` | `transferPositionToken`

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

## Event stream — `listenToEvents`

`listenToEvents` polls the Stellar Soroban RPC for on-chain protocol events and
delivers **strongly-typed payloads** to your callback. No WebSocket or
subgraph infrastructure is required — RPC polling on a 5 s interval matches
the ~5 s Stellar ledger cadence.

```ts
import { listenToEvents, Networks } from '@invofi/sdk';

const stop = listenToEvents({
  rpcUrl:            'https://soroban-testnet.stellar.org',
  networkPassphrase: Networks.TESTNET,
  // Pass all relevant contract IDs to cover the full protocol event surface:
  contractIds: [registryId, financingId, repaymentId, insuranceId, reputationId],
  // Optionally filter to a subset of the 20 protocol event types:
  eventTypes:  ['inv_reg', 'off_acc', 'inv_rep'],
  pollIntervalMs: 5_000,
  onEvent(event) {
    // TypeScript narrows `event.data` to the correct payload via `event.type`:
    switch (event.type) {
      case 'inv_reg':
        console.log('Invoice registered:', event.subjectId, 'by', event.data.originator);
        break;
      case 'off_acc':
        console.log('Offer accepted:', event.subjectId, 'lender', event.data.lender);
        break;
      case 'inv_rep':
        console.log('Repayment:', event.subjectId, 'fully paid?', event.data.fullyRepaid);
        break;
    }
  },
  onError(err, { attempt, nextRetryMs }) {
    console.error(`Poll attempt ${attempt} failed: ${err.message} — retry in ${nextRetryMs}ms`);
  },
});

// Stop polling when the component unmounts / script exits:
stop();
```

### All event types

| `event.type` | Contract   | Key payload fields                          |
|--------------|------------|---------------------------------------------|
| `inv_reg`    | registry   | `originator`, `amount`, `dueDate`           |
| `inv_amt`    | registry   | `newAmount`                                 |
| `inv_sts`    | registry   | `newStatus`                                 |
| `inv_cxl`    | registry   | `originator`                                |
| `inv_ovd`    | registry   | `dueDate`                                   |
| `inv_def`    | registry   | `invoiceId`                                 |
| `inv_dsp`    | registry   | `originator`                                |
| `inv_rsl`    | registry   | `newStatus`                                 |
| `off_new`    | financing  | `invoiceId`, `lender`, `amount`, `interestRate` |
| `off_wdr`    | financing  | `lender`                                    |
| `off_acc`    | financing  | `invoiceId`, `lender`, `amount`             |
| `off_rej`    | financing  | `invoiceId`                                 |
| `off_def`    | repayment  | `invoiceId`, `lender`                       |
| `pos_mint`   | financing  | `lender`, `amount`                          |
| `inv_rep`    | repayment  | `offerId`, `amount`, `fullyRepaid`          |
| `pool_stk`   | insurance  | `staker`, `amount`                          |
| `pool_un`    | insurance  | `staker`, `amount`                          |
| `pool_pay`   | insurance  | `recipient`, `amount`                       |
| `reputn`     | reputation | `address`, `score`                          |

### Event-driven upgrade path

The polling implementation is isolated inside `listenToEvents`. When a
WebSocket or server-sent-event relay becomes available, replace the internal
`poll()` loop with a streaming source. The `ProtocolEvent` types, `onEvent`,
and `onError` interfaces are unchanged — consumers migrate with zero code
changes.

### Options reference

| Option            | Type                        | Default    | Description |
|-------------------|-----------------------------|------------|-------------|
| `rpcUrl`          | `string`                    | required   | Soroban RPC endpoint |
| `networkPassphrase` | `string`                  | required   | e.g. `Networks.TESTNET` |
| `contractIds`     | `string[]`                  | required   | Contract IDs to listen on |
| `eventTypes`      | `ProtocolEventName[]`       | all events | Subset of event types to receive |
| `onEvent`         | `(event: ProtocolEvent) => void` | required | Typed event callback |
| `onError`         | `(err, ctx) => void`        | none       | Error callback (polling continues) |
| `pollIntervalMs`  | `number`                    | `5000`     | Poll interval in ms |
| `startLedger`     | `number`                    | latest     | Starting ledger (omit for live-only) |
| `maxRetries`      | `number`                    | `3`        | Max consecutive failures before back-off |

## Local dev

```bash
cd invofi/apps/sdk
npm install
npm run type-check
npm test
```
