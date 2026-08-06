# Roadmap

Last updated: August 2026. Checkbox status reflects what is merged to `main`
(and `master` in invofi-contracts) — nothing is marked done before it ships.

---

## What Is Built (testnet MVP + Week 1–3 expansion)

### Smart Contracts (invofi-contracts — 5 crates + position token)

- [x] Registry — invoice lifecycle: register, cancel, disputes, blacklist, status transitions
- [x] Financing — offers: create, withdraw, accept, reject; **SEP-41 principal transfer** (lender → business) and **position-token mint** on accept (Tasks 1, 7)
- [x] Repayment — full + partial repayment with **SEP-41 transfer** of principal + yield; overdue marking, reclaim/default (Tasks 2, 5)
- [x] Insurance — stake/unstake pool, **payout on default** capped at pool balance (Tasks 9–10)
- [x] Reputation — repayment outcomes → public originator score (Task 11)
- [x] Position token — SEP-41 `POS` minted 1:1 with principal; transferable between wallets (Tasks 7–8)
- [x] Emergency pause / circuit breaker on every state-mutating function (Task 4A)
- [x] Restricted cross-contract auth (registry ↔ financing ↔ repayment, insurance, reputation)
- [x] Deployer-bound initialization — `__constructor`, no front-runnable `initialize()` (issue #75)
- [x] Structured protocol events on every state-mutating function (Task 13 contracts half)
- [x] 110 passing tests across all crates; clippy `-D warnings`; Soroban Scout; commitlint gates (Task 19)

### Frontend / SDK (invofi)

- [x] Landing page, role-based auth (email/password via Supabase + wallet)
- [x] Wallet support: **Freighter + LOBSTR** via `@creit.tech/stellar-wallets-kit` approved allowlist (Task 6A)
- [x] Business dashboard, invoice creation, offer management
- [x] Lender marketplace (browse Pending invoices, sorting)
- [x] Lender portfolio with **remaining balance after partial repayments** + position-token trustline/transfer UI (Tasks 8)
- [x] Public `/stats` page reading indexer aggregates (Task 14)
- [x] `@invofi/sdk` — shared typed contract client consumed by the frontend (Task 15)
- [x] Alpha / demo mode when no contract is configured

### Infrastructure & Automation

- [x] 3-contract testnet deployment config (`NEXT_PUBLIC_{REGISTRY,FINANCING,REPAYMENT}_CONTRACT_ID`) (Task 6)
- [x] Keeper automation — 6-hourly overdue marking + TTL bumps (Task 12)
- [x] Event indexer — checkpointed replay → Supabase `protocol_stats` (Task 13 app half)
- [x] Contributors auto-table on merge (no opt-in comment needed), bot-driven PRs, issues open to all
- [x] One-click Testnet deploy via GitHub Actions (invofi-contracts)
- [x] Compliance posture documented (Task 17) — see [compliance.md](./compliance.md)

---

## Next Up

- [ ] Mainnet deployment (preceded by the SEP-12 KYC roadmap in compliance.md)
- [ ] Independent security audit (SCF Audit Bank)
- [ ] Oracle-based invoice verification and risk scoring
- [ ] Multi-signature treasury and escrow
- [ ] Contract upgradeability with timelock governance
- [ ] Demo video walkthrough (see [demo-video.md](./demo-video.md))
- [ ] Wave 8 reapplication / appeal package (see [wave8-reapplication.md](./wave8-reapplication.md))

---

## Long-Range

- [ ] Lender verification (threshold-based SEP-12 onboarding, Phase 4 of compliance.md)
- [ ] Secondary-market browsing/discovery for position tokens (transfer already ships)
- [ ] Event-driven keeper (Soroban RPC event subscriptions instead of polling)
- [ ] Historical time-series charts on `/stats`
