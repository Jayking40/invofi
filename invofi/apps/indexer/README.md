# InvoFi Protocol Indexer (Task 13)

A lightweight, scheduled poller that reads InvoFi's protocol events from
Stellar Soroban RPC (`getEvents`) and writes **aggregate stats** to a small
Postgres table in Supabase. The public `/stats` page (Task 14) reads that
row.

This is deliberately **not** a general-purpose subgraph/GraphQL indexer —
a simple polling script writing summary counts and volumes is the intended
scope.

## How it works

1. Reads authoritative on-chain totals from the contracts
   (`registry.get_stats()` → invoices/offers/financed/repaid,
   `insurance.get_pool_total()` → insurance pool).
2. Replays contract events (`inv_reg`, `off_acc`, `inv_rep`, `off_def`,
   `pool_*`, `reputn`, …) since the last checkpoint to derive aggregates the
   contracts don't expose on-chain: **unique active lenders** and the
   **defaulted count** — and cross-checks event volume against on-chain
   `total_financed`.
3. Upserts a single `protocol_stats` row (`id = 1`) that holds the current
   snapshot, including `last_ledger` as the checkpoint.

First run backfills the last `INDEXER_BACKFILL_LEDGERS` ledgers
(default 1,000,000 ≈ 2 months at testnet pace); subsequent runs are
incremental from the checkpoint.

## Supabase schema

Run this in the Supabase SQL editor (one time):

```sql
create table if not exists protocol_stats (
  id integer primary key default 1 check (id = 1),
  total_invoices integer not null default 0,
  total_offers integer not null default 0,
  invoices_financed integer not null default 0,
  total_volume text not null default '0',      -- stroops (i128 as string)
  total_repaid text not null default '0',      -- stroops
  repayment_rate numeric not null default 0,   -- 0..1
  active_lenders integer not null default 0,
  defaulted_invoices integer not null default 0,
  insurance_pool text not null default '0',    -- stroops
  last_ledger bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table protocol_stats enable row level security;

-- Public read for the /stats page (anon + authenticated)
create policy "public read protocol_stats"
  on protocol_stats for select using (true);
```

The indexer writes with the **service-role key** (bypasses RLS). The frontend
reads with the anon key under the public-read policy.

## Run locally

```bash
cp .env.example .env.local   # fill in values
npm install
npm run index                # or: npx tsx src/index.ts
```

## GitHub Action

`.github/workflows/indexer.yml` runs it on a schedule (every 6 hours) plus
`workflow_dispatch`. Required repo configuration:

| Secret / Variable | Purpose |
|---|---|
| `SUPABASE_URL` (secret) | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` (secret) | Service-role key for writes |
| `REGISTRY_CONTRACT_ID` / `FINANCING_CONTRACT_ID` / `REPAYMENT_CONTRACT_ID` / `INSURANCE_CONTRACT_ID` / `REPUTATION_CONTRACT_ID` (variables) | Default to the live testnet deployment; override per deployment |
