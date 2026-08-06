# Wave 8 Reapplication / Appeal — Evidence Package

> **Task 21 — human-track deliverable.** This file is the submission outline
> and evidence checklist. The actual application is submitted on Drips'
> platform by the maintainer; everything referenced here already exists in
> the two repos.

---

## 1. Narrative (two sentences for the application)

> "InvoFi is an open-source invoice-financing protocol on Stellar Soroban,
> restructured into two auditable repositories with **five deployed contract
> crates that move real tokens on testnet** (SEP-41 principal transfer on
> accept, repayment of principal + yield, position tokens, insurance pool,
> reputation). It ships an **emergency pause**, 110 passing contract tests, a
> commitlint gate, and honest documentation — including a documented
> engineering self-review of the token-movement code (not a substitute for a
> real audit, which is the next step)."

---

## 2. Evidence checklist — all verifiable today

| Evidence | Where |
|---|---|
| Two-repo topology (app / contracts) with cross-linking READMEs | invofi, invofi-contracts |
| **Real token movement on testnet** — `accept_offer` transfers lender → business; `repay_invoice` repays principal + yield | financing/src/lib.rs:394, repayment/src/lib.rs:216; verified E2E in CHANGELOG 0.6.0 |
| **Emergency pause** (Task 4A) — admin-gated, 22 call sites, test coverage | common/src/lib.rs:170; ADR-0001 |
| **110 tests** passing, clippy `-D warnings`, Soroban Scout, commitlint in CI | `.github/workflows/ci.yml` + `clippy.yml` + `scout-security-analysis.yml` |
| **Deployer-bound initialization** — no front-runnable `initialize()` | `__constructor` on all 5 contracts; ADR-0005; issue #75 |
| Tagged issue backlog, issues open to all, auto contributors table, bot-driven PRs | GitHub — both repos |
| Security self-review pass (Tasks 1/2/4A) | invofi-contracts/docs/security-self-review.md |
| Compliance posture — KYC/SEP-12 roadmap, jurisdictions, securities-by-design | invofi/docs/compliance.md |
| Live testnet deployment + public `/stats` page | invofi-five.vercel.app/stats; stellar.expert links in README |
| Demo video (once recorded) | docs/demo-video.md |

---

## 3. Appeal vs fresh application

1. Check whether the Wave 7 rejection is **appealable** via Drips' process
   (available since Wave 7). If yes, appeal citing the evidence above.
2. Otherwise submit a **fresh application** with the same evidence.
3. **Do not submit before Tasks 1–2 are merged** (they are — see commits
   `1483c0a`, `b31bef3`) and **do not skip the self-review pass** (it exists —
   see §2). "Real fund movement" is the single most important piece of
   evidence, which is why it gets the closest look.

---

## 4. Submission checklist

- [ ] Demo video recorded + unlisted link added to both READMEs (Task 20)
- [ ] Fresh re-read of `docs/security-self-review.md` with any new commits
- [ ] Confirm CI green on both repos at submission time
- [ ] Confirm `/stats` reflects current on-chain aggregates
- [ ] Submit / appeal on Drips; link both repos, the video, and the
      self-review
