```
 ██╗███╗   ██╗██╗   ██╗ ██████╗ ███████╗██╗
 ██║████╗  ██║██║   ██║██╔═══██╗██╔════╝██║
 ██║██╔██╗ ██║██║   ██║██║   ██║█████╗  ██║
 ██║██║╚██╗██║╚██╗ ██╔╝██║   ██║██╔══╝  ██║
 ██║██║ ╚████║ ╚████╔╝ ╚██████╔╝██║     ██║
 ╚═╝╚═╝  ╚═══╝  ╚═══╝   ╚═════╝ ╚═╝     ╚═╝
```

<div align="center">

**Decentralized Invoice Financing on Stellar Soroban**

[![CI](https://github.com/Stellar-VaultLink/invofi/actions/workflows/ci.yml/badge.svg)](https://github.com/Stellar-VaultLink/invofi/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Built on Stellar](https://img.shields.io/badge/Built%20on-Stellar-7B4FE2)](https://stellar.org)
[![Soroban](https://img.shields.io/badge/Smart%20Contracts-Soroban-FF5B36)](https://soroban.stellar.org)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Auth-Supabase-3ECF8E)](https://supabase.com)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black)](https://invofi-five.vercel.app)

[Live Demo](https://invofi-five.vercel.app) · [Docs](https://stellar-vault-link.gitbook.io/stellar-vault-link-docs) · [Contributing](./CONTRIBUTING.md) · [Report Bug](https://github.com/Stellar-VaultLink/invofi/issues)

</div>

---

## What is InvoFi?

InvoFi is an open-source, decentralised invoice financing protocol built on **Stellar Soroban**. It solves a real problem: small and medium businesses often wait 30–90 days to get paid on invoices, starving them of working capital.

InvoFi lets businesses **tokenise their invoices as on-chain assets** and instantly receive financing from a global pool of investors. Investors earn yield. Businesses get liquidity. Everything is governed by smart contracts — no banks, no middlemen, no trust required.

```text
Business registers invoice  →  Lenders compete with offers  →  Business accepts best offer
→  Funds available immediately  →  Business repays (full or partial)  →  Lender earns yield
```

---

## Repositories

InvoFi's code lives across three repos with distinct jobs:

| Repo | Role |
|---|---|
| **[invofi](https://github.com/Stellar-VaultLink/invofi)** (this repo) | Integration monorepo. Vercel deploys the frontend straight out of `invofi/apps/frontend`. Full history, issue backlog, and roadmap live here. |
| **[invofi-frontend](https://github.com/Stellar-VaultLink/invofi-frontend)** | Where frontend contributions happen — UI, hooks, client-side work. Scoped CI, its own issue queue. |
| **[invofi-contracts](https://github.com/Stellar-VaultLink/invofi-contracts)** | Where contract contributions happen — Soroban/Rust. Scoped CI, its own issue queue. |

Merged PRs in the component repos are periodically pulled into this monorepo (via `scripts/sync-subtrees.sh`) and deployed from here.

---

## Live Demo

> **Frontend:** [invofi-five.vercel.app](https://invofi-five.vercel.app)
> **Contract on Stellar Testnet:** [`CDJS6AFE6VRPAPWOPWOPZLSLQ7NCISA7YHOMAE7HJWOD7G6CQDCVT4L2`](https://lab.stellar.org/r/testnet/contract/CDJS6AFE6VRPAPWOPWOPZLSLQ7NCISA7YHOMAE7HJWOD7G6CQDCVT4L2)

```bash
git clone https://github.com/Stellar-VaultLink/invofi.git
cd invofi/apps/frontend
cp .env.local.example .env.local   # fill in Supabase + contract values
npm install && npm run dev
# → http://localhost:3000
```

---

## Key Features

### For Businesses
- Register invoices on-chain in under 60 seconds
- Receive competing financing offers from a global investor pool
- Accept the best offer and get immediate liquidity
- Full and **partial repayment** tracked on-chain
- No bank account or credit history needed — your invoice is the collateral

### For Lenders / Investors
- Browse a marketplace of verified on-chain invoices
- Submit financing offers with custom interest rates and duration
- Track active investments and yields in a live portfolio
- Transparent partial repayment history on the Stellar blockchain

### Protocol Properties
- **Trustless** — all terms, state transitions, and repayments enforced by Soroban smart contracts
- **Transparent** — every action is a public transaction on Stellar, auditable by anyone
- **Permissionless** — anyone with a Stellar wallet can participate
- **Dual auth** — email/password (Supabase) and Stellar wallet (Freighter or Lobstr)
- **Multi-currency** — invoices denominated in XLM or USDC
- **Partial repayment** — businesses can repay incrementally; offer stays Financed until fully cleared
- **Free to deploy** — Vercel (free) + Supabase (free) + Stellar testnet

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (User)                           │
│   Next.js 14 App Router — deployed on Vercel                   │
│                                                                  │
│   ┌──────────────────┐      ┌──────────────────────────────┐   │
│   │  Email / Password │      │   Freighter / Lobstr Wallet   │   │
│   │  auth via Supabase│      │   signs Soroban transactions  │   │
│   └────────┬──────────┘      └──────────────┬───────────────┘   │
└────────────┼────────────────────────────────┼───────────────────┘
             │                                │
             ▼                                ▼
    ┌─────────────────┐          ┌────────────────────────────┐
    │    Supabase      │          │   Stellar Soroban Contract │
    │  Auth + mirror   │          │   invofi-invoice-registry  │
    │                  │          │                            │
    │  user_profiles   │          │  register_invoice()        │
    │  invoices        │          │  create_offer()            │
    │  financing_offers│          │  accept_offer()            │
    └─────────────────┘          │  repay_invoice()  ◄─ partial│
                                  │  mark_overdue()            │
                                  │  reclaim_invoice()         │
                                  │  get_invoices_by_status()  │
                                  └──────────────┬─────────────┘
                                                 │
                                  ┌──────────────▼─────────────┐
                                  │   Stellar Horizon API       │
                                  │   Balance + tx history      │
                                  └────────────────────────────┘
```

No backend server. No database to manage. 100% free hosting.

---

## Project Structure

```text
invofi/
├── invofi/apps/
│   ├── contracts/                    Soroban Rust smart contract
│   │   ├── lib.rs                    Core protocol — all 17 contract functions
│   │   ├── test.rs                   21+ contract tests
│   │   ├── Cargo.toml
│   │   └── scripts/
│   │       ├── deploy.sh             Build + deploy to testnet/mainnet
│   │       └── fund-and-deploy.sh    Generate + fund deployer key, then deploy
│   └── frontend/                     Next.js 14 web application
│       └── src/
│           ├── app/
│           │   ├── page.tsx          Landing page
│           │   ├── layout.tsx        Root layout + providers
│           │   ├── dashboard/        Business invoice dashboard
│           │   ├── invoices/         Create and view invoices
│           │   ├── marketplace/      Lender invoice browser
│           │   ├── portfolio/        Lender investment tracker
│           │   ├── profile/          User profile + display name
│           │   └── settings/         Account settings
│           ├── components/
│           │   ├── auth/             AuthGuard, WalletButton, WalletProvider,
│           │   │                     WalletSelectDialog (Freighter + Lobstr picker)
│           │   ├── common/           ConfirmDialog, StatsCard, StatsGrid,
│           │   │                     StatusBadge, PageHeader, EmptyState
│           │   ├── invoices/         InvoiceCard, InvoiceForm, InvoiceTable,
│           │   │                     OfferList
│           │   ├── layout/           Navbar (dark mode + a11y), Footer
│           │   └── ui/               shadcn/ui — button, dialog, table,
│           │                         badge, card, input, tabs, toast...
│           ├── hooks/                useInvoices, useOffers, useMarketplace,
│           │                         useLocalStorage, useDebounce, useMediaQuery
│           └── lib/
│               ├── contract.ts       Soroban contract call helpers
│               ├── freighter.ts      Freighter v6 wallet helpers
│               ├── walletkit.ts      @creit.tech/stellar-wallets-kit init + Lobstr
│               ├── horizon.ts        Stellar Horizon API helpers
│               ├── supabase.ts       Auth + database helpers
│               ├── formatters.ts     Amount, date, address formatters
│               ├── csv.ts            CSV export helpers
│               └── constants.ts      Network config, risk tiers, enums
├── scripts/
│   ├── sync-subtrees.sh              Pull/push invofi-frontend + invofi-contracts
│   └── close-issues.sh              Bulk GitHub issue close
├── docs/
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
└── LICENSE
```

---

## Smart Contract Reference

Contract: `invofi-invoice-registry` · `invofi/apps/contracts/lib.rs`

### Invoice Fields

| Field | Type | Description |
|---|---|---|
| `id` | `Symbol` | Unique invoice identifier |
| `originator` | `Address` | Stellar address of the business |
| `amount` | `i128` | Invoice amount in stroops (10,000,000 stroops = 1 unit) |
| `currency` | `Symbol` | `XLM` or `USDC` |
| `due_date` | `u64` | Unix timestamp of payment due date |
| `status` | `InvoiceStatus` | `Pending → Financed → Repaid / Overdue / Cancelled` |

### FinancingOffer Fields

| Field | Type | Description |
|---|---|---|
| `id` | `Symbol` | Unique offer identifier |
| `invoice_id` | `Symbol` | Invoice this offer targets |
| `lender` | `Address` | Stellar address of the investor |
| `amount` | `i128` | Offer amount in stroops |
| `currency` | `Symbol` | `XLM` or `USDC` |
| `interest_rate` | `u32` | Basis points (500 = 5.00%) |
| `duration` | `u64` | Financing duration in seconds |
| `amount_repaid` | `i128` | Running total of stroops repaid so far |
| `status` | `OfferStatus` | `Pending → Accepted → Financed → Repaid / Rejected / Defaulted` |
| `funded_at` | `u64` | Unix timestamp when offer was accepted |

### Contract Functions

| Function | Auth | Description |
|---|---|---|
| `initialize(admin, token)` | Anyone (once) | One-time setup — sets admin and SEP-41 token |
| `register_invoice(id, originator, amount, currency, due_date)` | Originator | Register a new invoice; validates `amount > 0` and `due_date > now` |
| `get_invoice(id)` | Anyone | Read invoice state |
| `update_invoice_status(id, status)` | Originator | Manually change invoice status |
| `create_offer(offer_id, invoice_id, lender, amount, currency, rate, duration)` | Lender | Submit a financing offer; validates `amount > 0`, `rate > 0` |
| `get_offer(id)` | Anyone | Read offer state |
| `accept_offer(offer_id, originator)` | Business | Accept offer → pulls lender's principal via prior `token.approve`, pays business; invoice → Financed |
| `reject_offer(offer_id, originator)` | Business | Reject a pending offer |
| `repay_invoice(invoice_id, offer_id, repayer, amount)` | Business | Pay `amount` stroops toward the outstanding balance. Offer stays Financed until `amount_repaid >= principal + yield`; then → Repaid |
| `mark_overdue(invoice_id)` | Anyone | Mark a past-due Financed invoice as Overdue |
| `reclaim_invoice(invoice_id, offer_id, lender)` | Lender | After 7-day grace period on Overdue invoice, marks offer Defaulted |
| `get_invoices_by_status(status)` | Anyone | Return all invoices matching a given `InvoiceStatus` |
| `set_rate(admin, tier, rate_bps)` | Admin | Set yield rate for risk tier A/B/C |
| `get_rate(tier)` | Anyone | Read the configured rate for a risk tier |
| `transfer_admin(admin, new_admin)` | Admin | Rotate the admin address |
| `get_admin()` | Anyone | Read the admin address |
| `get_token()` | Anyone | Read the configured SEP-41 token address |

### Invoice Lifecycle

```text
register_invoice()
      │
      ▼
  [Pending] ────────────────────────────────────── reject_offer() ──► stays Pending
      │
  accept_offer() ── pays principal to business
      │
      ▼
  [Financed] ◄──────────────────────────────────── repay_invoice() (partial)
      │
      ├── repay_invoice() (balance cleared) ──────► [Repaid]
      │
      └── mark_overdue() ────────────────────────► [Overdue]
                                                       │
                                                   reclaim_invoice()
                                                   (after 7-day grace)
                                                       │
                                                       ▼
                                                  offer → [Defaulted]
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Smart Contracts | Rust + Soroban SDK 22 | Native Stellar contract platform |
| Frontend | Next.js 14 (App Router) + TypeScript 5.5 | Free Vercel deployment, SSR |
| Styling | Tailwind CSS + shadcn/ui | Fast, accessible, composable |
| Auth | Supabase | Free tier, row-level security |
| Wallet | Freighter v6 + Lobstr via `@creit.tech/stellar-wallets-kit` | Multi-wallet — users choose at connect time |
| Data Fetching | TanStack Query v5 | Caching, background refetch |
| Forms | React Hook Form + Zod | Type-safe validation |
| Icons | Lucide React | Consistent icon set |
| Stellar SDK | `@stellar/stellar-sdk` v16 | Contract calls, Horizon queries |

---

## Getting Started

### Prerequisites

- [Node.js 20+](https://nodejs.org)
- [Rust 1.70+](https://rustup.rs) with `wasm32-unknown-unknown` target (`rustup target add wasm32-unknown-unknown`)
- [Freighter wallet](https://freighter.app) browser extension
- A free [Supabase](https://supabase.com) account

### 1. Clone

```bash
git clone https://github.com/Stellar-VaultLink/invofi.git
cd invofi
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run the schema below in **SQL Editor**.
3. Copy your **Project URL** and **Anon Key** from Settings → API.

### 3. Configure environment

```bash
cd invofi/apps/frontend
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_CONTRACT_ID
```

### 4. Run the frontend

```bash
npm install && npm run dev
# → http://localhost:3000
```

### 5. Build and test contracts

```bash
cd ../contracts
cargo test          # 21+ tests
stellar contract build
```

### 6. Deploy contract to testnet

```bash
cargo install --locked stellar-cli
stellar keys generate --global invofi-deployer --network testnet
stellar keys fund invofi-deployer --network testnet
stellar contract build
stellar contract deploy \
  --wasm target/wasm32v1-none/release/invofi_invoice_registry.wasm \
  --source invofi-deployer \
  --network testnet
# Copy CONTRACT_ID into .env.local, then call initialize() once
stellar contract invoke \
  --id <CONTRACT_ID> --source invofi-deployer --network testnet \
  -- initialize --admin <ADMIN_ADDRESS> --token <SEP41_TOKEN>
```

Live testnet contract: `CDJS6AFE6VRPAPWOPWOPZLSLQ7NCISA7YHOMAE7HJWOD7G6CQDCVT4L2`

---

## Supabase Setup

```sql
create table user_profiles (
  id uuid primary key references auth.users(id),
  email text not null,
  role text not null check (role in ('business', 'lender')),
  display_name text,
  wallet_address text,
  created_at timestamptz default now()
);

create table invoices (
  id text primary key,
  originator text not null,
  originator_id uuid references auth.users(id),
  amount text not null,
  currency text not null,
  due_date timestamptz not null,
  status text not null default 'Pending',
  created_at timestamptz default now()
);

create table financing_offers (
  id text primary key,
  invoice_id text references invoices(id),
  lender_id uuid references auth.users(id),
  lender text not null,
  amount text not null,
  currency text not null,
  interest_rate integer not null,
  duration integer not null,
  amount_repaid text not null default '0',
  status text not null default 'Pending',
  funded_at integer default 0,
  created_at timestamptz default now()
);

alter table user_profiles enable row level security;
alter table invoices enable row level security;
alter table financing_offers enable row level security;

create policy "Anyone can read invoices" on invoices for select using (true);
create policy "Owner can insert invoices" on invoices for insert with check (originator_id = auth.uid());
create policy "Owner can update invoices" on invoices for update using (originator_id = auth.uid());

create policy "Anyone can read offers" on financing_offers for select using (true);
create policy "Lender can insert offers" on financing_offers for insert with check (lender_id = auth.uid());
create policy "Parties can update offers" on financing_offers for update
  using (lender_id = auth.uid() or
    exists (select 1 from invoices where id = invoice_id and originator_id = auth.uid()));

create policy "Own profile" on user_profiles for all using (id = auth.uid());
```

---

## Deployment (Vercel)

1. Push fork to GitHub.
2. Vercel → **New Project** → import → set **Root Directory** to `invofi/apps/frontend`.
3. Add environment variables:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `NEXT_PUBLIC_CONTRACT_ID` | Output from `stellar contract deploy` |
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` |
| `NEXT_PUBLIC_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `NEXT_PUBLIC_HORIZON_URL` | `https://horizon-testnet.stellar.org` |

---

## Roadmap

- [x] Core invoice registry contract (register, offer, accept, reject, repay, overdue, reclaim)
- [x] Partial repayment — `amount_repaid` tracking, offer stays Financed until balance cleared
- [x] Query helper — `get_invoices_by_status(status)` for server-side filtering
- [x] Input validation — `amount > 0`, `due_date > now`, `interest_rate > 0`
- [x] Next.js 14 frontend with Freighter v6 wallet
- [x] Supabase auth (email + wallet), dark mode, accessibility
- [x] Marketplace and portfolio views, sortable InvoiceTable, StatsCard KPIs
- [x] Profile page, ConfirmDialog, EmptyState, LoadingSkeleton components
- [ ] Mainnet deployment
- [ ] Oracle-based invoice verification and risk scoring
- [ ] Multi-signature treasury and escrow
- [ ] KYC / AML with SEP-12 support
- [ ] Contract upgradeability with timelock governance

---

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. For bugs and features, use [GitHub Issues](https://github.com/Stellar-VaultLink/invofi/issues).

## Security

Do not open a public issue for security vulnerabilities. See [SECURITY.md](./SECURITY.md) for responsible disclosure.

## License

MIT © 2026 InvoFi Contributors. See [LICENSE](./LICENSE).
