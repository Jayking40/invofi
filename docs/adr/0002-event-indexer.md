# ADR-0002: Event indexer + off-chain store

**Status:** Accepted (2026-08-06) · **Task:** 13 (indexer), 14 (stats page)

## Context

InvoFi needs protocol-wide aggregates (invoices financed, total volume,
repayment rate, active lenders, insurance pool size) for a public /stats page
(Task 14). Soroban contracts must never return unbounded lists — a full-list
read would blow past transaction resource limits at scale. So "browse all
invoices" and "protocol totals" are off-chain concerns.

## Decision

1. **Contracts are the source of truth for what they already track.**
   `registry.get_stats()` (invoices/offers/financed/repaid) and
   `insurance.get_pool_total()` are read directly by the indexer and win over
   any event-derived number. Every state-mutating contract function publishes
   a structured Soroban event (Task 13 audit completed the gaps).
2. **A lightweight poller, not a subgraph.** `apps/indexer` runs on a GitHub
   Action schedule (every 6 hours, plus `workflow_dispatch`). It reads
   `getEvents` via Soroban RPC, replays events since a ledger checkpoint, and
   writes one aggregate row to a small Postgres table (`protocol_stats`,
   `id=1`) in Supabase — the project's existing database.
3. **Event replay fills the gaps the contracts don't expose**: unique active
   lenders and defaulted count, plus an independent cross-check of event
   volume vs on-chain `total_financed` (reported in the Action log).
4. **No time-series charts in this pass** — current totals only (Task 14
   scope). Historical series are a follow-up Wave issue, not this plan's scope.

## Alternatives considered

- **General-purpose subgraph/GraphQL indexer** — rejected: far more than this
  plan needs; a polling script writing aggregates is the intended scope.
- **Contracts return full lists** — rejected: violates Soroban resource limits
  at scale; the whole point of an off-chain indexer.
- **Frontend reads RPC directly per request** — rejected: heavy, slow, and the
  /stats page is public (no wallet) — RPC reads need a funded account.

## Consequences

- Counts shown on /stats are authoritative (on-chain reads) where possible.
- Event history older than the RPC retention window (~5 days) can't be
  replayed; the indexer degrades to on-chain totals + a warning instead of
  fabricating numbers.
- The `protocol_stats` table needs a one-time SQL setup and a public-read RLS
  policy (documented in `apps/indexer/README.md`).
