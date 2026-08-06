# Development Since the Original Submission — Appeal Response

**Question:** *What development work / improvements have you made since the
repo was initially rejected?*

**Short answer:** Since the original submission, InvoFi went from a
single-crate demo-style contract with no real token movement and a
monolithic app repo, to **two auditable repositories**: a modular
**5-contract Soroban system (plus a SEP-41 position token) that moves real
tokens on testnet**, and a production-shaped app repo with an SDK, keeper
automation, an event indexer, an emergency pause, 110 passing tests, static
analysis in CI, and a fully documented compliance/security posture.

Every item below is **merged to the default branch** and independently
verifiable (commit hashes, test counts, and a live testnet deployment).

---

## 1. invofi-contracts — what changed since rejection

### 1.1 Real token movement (was the single biggest gap)

| Improvement | Detail | Evidence |
|---|---|---|
| SEP-41 transfer on `accept_offer` | Lender's principal moves **lender → business** inside the accept transaction (approve + pull pattern) | `financing/src/lib.rs:394`; commit `1483c0a` |
| SEP-41 transfer on `repay_invoice` | Full **and partial** repayment of principal + yield, with protocol fee split | `repayment/src/lib.rs:216`; `1483c0a` |
| Currency registry | `XLM`/`USDC` resolved via a registry map — adding a third currency is one entry, not a code branch | `1483c0a` |
| Failure-path tests | Insufficient balance, wrong currency, over-payment, wrong-caller — all assert the correct panic | Task 3, in `1483c0a` |
| **Verified on-chain** | Full E2E on the live testnet deployment: register → offer → accept (XLM moved + POS minted) → repay → Repaid | CHANGELOG 0.6.0 "Verified (testnet)" |

### 1.2 Modular, auditable architecture (was: one monolith crate)

- Monolith split into **5 contract crates** — `registry`, `financing`,
  `repayment`, `insurance`, `reputation` — plus a shared `common` crate
  (commits `b31bef3`, `be6ebc1`).
- **Caller-guarded cross-contract auth**: registry only accepts status
  transitions from the registered financing/repayment contracts; financing
  only accepts repayment callbacks from the registered repayment contract
  (commit `cfa5d41`). User auth never propagates across contract boundaries.
- Storage uses **keyed lookups + paginated reads** (`get_invoices_paginated`,
  `batch_get_invoices`) — never an unbounded on-chain list — so the protocol
  stays within Soroban resource limits as invoice count grows.

### 1.3 New protocol functionality (did not exist at rejection)

| Feature | What it does | Evidence |
|---|---|---|
| **Position tokens** (Task 7) | On `accept_offer`, a SEP-41 `POS` token is minted to the lender 1:1 with principal | `ed34e6a`; ADR-0002 |
| **Transferable positions** (Task 8) | Position tokens are plain Stellar assets — holders can transfer their claim | `ed34e6a` |
| **Insurance pool** (Task 9) | `stake`/`unstake` with flat pool accounting, pool-balance reconciliation | `ed34e6a`; ADR-0003 |
| **Payout on default** (Task 10) | `reclaim_invoice` triggers `insurance.pay_out` capped at pool balance | `da947ea` |
| **Reputation** (Task 11) | `record_outcome` → public score (`repayments − 2×defaults`, floor 0) | `da947ea`; ADR-0004 |
| **Emergency pause** (Task 4A) | Admin-gated pause checked at the top of every state-mutating function (22 call sites) | `cfa5d41`; ADR-0001 |
| **Full protocol events** (Task 13) | Every state transition publishes a structured Soroban event (18 event types) for indexers | `d35c935` |

### 1.4 Security & trust

- **Deployer-bound initialization** (issue #75, reported by an external
  reviewer): `initialize()` removed from all five contracts — one-time setup
  now runs in the Soroban **`__constructor`**, executing atomically inside
  the deploy operation so it **cannot be front-run** (commit `2fc4d4d`).
  Regression tests prove the admin is bound at deploy and that a post-deploy
  `__constructor` invoke fails.
- **Private Vulnerability Reporting enabled** + `SECURITY.md` with a real
  maintainer contact channel (issue #75 follow-up, commits `3fb6ec0`).
- **Documented engineering self-review** of the token-movement and pause
  code against an auth/overflow/reentrancy checklist —
  `docs/security-self-review.md` (explicitly *not* a substitute for a real
  audit; the audit is the stated next step).

### 1.5 Quality gates & CI

- Tests grew from **9 → 110**, passing across all five crates
  (`cargo test`).
- **clippy `-D warnings`** and **Soroban Scout** static analysis run on
  every PR (commit `1483c0a`).
- **commitlint** enforces Conventional Commits on every PR (Task 19).
- One-click **Deploy Contract** workflow deploys and wires all five
  contracts in dependency order (registry → financing → repayment →
  insurance → reputation).
- Architecture Decision Records (ADR-0001…0005), CHANGELOG, contributor
  auto-table, CODEOWNERS, and a label → complexity mapping for contributors.

---

## 2. invofi (monorepo) — what changed since rejection

### 2.1 Frontend

| Improvement | Detail | Evidence |
|---|---|---|
| 3-contract wiring | Frontend now targets `registry`/`financing`/`repayment` contract IDs via env config (Task 6) | `66de3ced` |
| **Approved-wallet allowlist** (Task 6A) | Freighter **and LOBSTR** via `@creit.tech/stellar-wallets-kit`; approving a 3rd wallet is a one-line config change | `66de3ced`, `d1fac7ad` |
| Position-token transfer UI | One-click POS trustline + **Transfer Position** in the portfolio (Task 8) | `4b53dd52` |
| Remaining balance | Portfolio shows the **outstanding balance after partial repayments** | `b5be4acf`, `c74598a1` |
| Defaulted status + keeper docs | Full lifecycle status coverage in the UI (Tasks 10–12) | `359de3d5` |
| Verified build | `tsc --noEmit` exits 0; `next build` builds all routes including `/stats` | CI run `31108800288` (green) |

### 2.2 SDK

- **`@invofi/sdk`** extracted as a typed contract client consumed by the
  frontend — no duplicated contract-call code remains in the app (Task 15,
  commits `c3f772ae`, `3f4067a8`, `390f696e`).

### 2.3 Automation & observability

- **Keeper** (Task 12): 6-hourly GitHub Action that marks past-due Financed
  invoices Overdue and extends contract-data TTLs — paginated from the
  start for scalability.
- **Event indexer** (Task 13) + **public `/stats` page** (Task 14): the
  indexer replays protocol events into an aggregates table the `/stats` page
  renders. *(The indexer is temporarily bypassed pending a database
  migration; the contracts emit everything needed to re-enable it.)*
- **Commitlint + CHANGELOG** (Task 19): Conventional Commits enforced on PRs;
  changelogs generated for both repos.

### 2.4 Documentation & governance

- **Compliance posture** (`docs/compliance.md`, Task 17): KYC/SEP-12 phased
  roadmap, jurisdictions avoided at launch, and an explicit
  securities-by-design analysis of the offer/lender flows.
- **READMEs refreshed** (Task 18): accurate architecture diagram (2-repo /
  6-contract system), roadmap synced to shipped reality, Freighter + LOBSTR
  listed, Maintainers/Contributors sections.
- **Two-repo topology**: contracts migrated out to `invofi-contracts`;
  the old `invofi-frontend` repo archived with history preserved — no commit
  history was destroyed.
- **Open community process**: anyone can open issues (no interaction
  limits, no auto-close bot), all-contributors table auto-updates on merge,
  bot-driven PRs enabled, dependabot PRs triaged and merged.

---

## 3. Before → After (summary)

| Dimension | Original submission | Now |
|---|---|---|
| Contract architecture | 1 crate (monolith) | **5 auditable crates + common + POS token** |
| Token movement | None (alpha/off-chain) | **Real SEP-41 transfers on testnet, E2E verified** |
| Contract tests | 9 | **110** |
| Static analysis | none | **clippy `-D warnings` + Soroban Scout + commitlint** |
| Admin/init security | public `initialize()` | **deployer-bound `__constructor`** (issue #75) |
| Wallets | Freighter only | **Freighter + LOBSTR (approved allowlist)** |
| Insurance / reputation | — | **stake/unstake, payout-on-default, scoring** |
| Automation | — | **keeper (overdue + TTL), event indexer, deploy workflow** |
| Governance docs | — | **ADRs, SECURITY.md + PVR, compliance, self-review, CHANGELOG** |

---

## 4. Verifiable proof points

- **Live app:** https://invofi-five.vercel.app (HTTP 200, `/stats` included)
- **Live testnet contracts:** registry / financing / repayment / insurance /
  reputation + POS — IDs and stellar.expert links in the README's *Live
  Demo* section; E2E verified in CHANGELOG 0.6.0
- **CI:** green on both repos (frontend lint/typecheck/build; contracts
  test/clippy/Scout/commitlint)
- **Code:** all commits above are on `main` (invofi) and `master`
  (invofi-contracts)
