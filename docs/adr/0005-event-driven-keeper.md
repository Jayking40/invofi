# ADR-0005: Event-driven keeper upgrade (RPC event subscriptions)

**Status:** Accepted (2026-08-18)

## Context

The InvoFi keeper (`invofi/scripts/keeper.ts`) performs two critical protocol maintenance tasks:
1. `mark_overdue`: Calling `repayment.mark_overdue` on past-due Financed invoices.
2. `bump_ttl`: Extending contract storage footprint TTL for active invoices so state entries never expire on Soroban testnet/mainnet.

Previously (Task 12), the keeper operated exclusively as a 6-hourly batch job via GitHub Actions. As invoice volume increases, scanning all pages of invoices on every run becomes expensive and introduces up to a 6-hour delay before past-due invoices are marked overdue or newly registered/financed invoices receive TTL bumps.

## Decision

1. **Soroban RPC Event Subscriptions (`getEvents`)**:
   Upgrade the keeper to run in an event-driven mode (`KEEPER_MODE=event-driven` or `--mode=event-driven`). The keeper continuously polls Soroban RPC `getEvents` with ledger cursor tracking for contract events emitted by `invofi-registry` and `invofi-financing`.

2. **Targeted Event Handlers**:
   - **`inv_reg`** (Invoice Registered): When a new invoice is created on-chain, the keeper instantly receives the event and performs an immediate best-effort TTL bump (`bumpTtl(invoiceId)`).
   - **`off_acc`** (Offer Accepted -> Financed): When an offer is accepted and an invoice transitions to `Financed`, the keeper instantly performs a TTL bump, checks if `due_date < now`, and calls `repayment.mark_overdue` immediately if past-due.
   - **`inv_ovd` / `inv_rep` / `inv_def`**: State update events update the keeper's in-memory tracking.

3. **Polling Fallback Retained**:
   The full-sweep paginated invoice scan is retained both:
   - As a periodic background fallback loop (defaulting to every 6 hours) in continuous daemon mode.
   - As a one-shot execution mode (`KEEPER_MODE=sweep`, default fallback) for scheduled cron jobs.
   This guarantees 100% resilience against network partitions, process restarts, or missing events beyond RPC retention limits.

4. **Ledger Cursor Checkpointing**:
   In event-driven mode, the keeper maintains an in-memory and optional disk checkpoint (`.keeper-checkpoint.json`) of the last processed ledger sequence, allowing seamless catch-up after restarts without missed events.

## Consequences

- Reaction latency for newly registered or financed invoices drops from hours (up to 6h) to under a minute (~5–10s ledger poll).
- RPC load is significantly reduced because state scanning occurs incrementally based on events, while the full sweep runs only as a periodic fallback.
- The keeper remains backward compatible with existing 6-hourly GitHub Actions cron jobs (`npm run keeper` in `sweep` mode).
