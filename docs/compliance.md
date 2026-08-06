# Compliance & Regulatory Posture

> **Status:** Informational — not legal advice. This document describes InvoFi's
> intended compliance posture, the timeline for adding KYC/AML, and the
> reasoning behind the protocol's current design choices. It does not replace
> advice from a qualified attorney in any jurisdiction where the protocol may
> be used. Before a mainnet launch or any tokenized-pool feature, the analysis
> in the *Securities* section **must** be re-validated by counsel.

---

## 1. Current Status (as of this document)

| Dimension | Status |
|---|---|
| Network | Stellar **testnet** only (no mainnet deployment) |
| Access | Permissionless — no registration gate, no KYC |
| Custody | None — users self-custody their Stellar keys and assets |
| Fiat on/off-ramps | None built in; users obtain XLM/USDC independently |
| Real value moved | Testnet XLM/USDC only (SEP-41 token transfers) |

The protocol is a public-good research deployment. Because it moves no
real-world value on mainnet and holds no user funds, most licensing and
KYC/AML obligations are not yet engaged. The roadmap below is designed to
change that deliberately and in sequence, *before* mainnet launch.

---

## 2. KYC / AML Roadmap (SEP-12)

Stellar's [SEP-12](https://stellar.org/protocol/sep-12) defines the standard
for KYC/AML data exchange between anchors and wallets. Our plan is to adopt
it as the *identity layer* for protocol participants who need it — the
blockchain itself stays permissionless, but the **product layer** (the
frontend) can enforce KYC for on-ramping participants.

| Phase | Scope | Target timeline |
|---|---|---|
| **Phase 0 — now** | Documented posture, no KYC. Testnet only. Jurisdictional blocklist maintained in docs (below). | Shipped |
| **Phase 1 — pre-mainnet** | Build an optional SEP-12 integration behind an abstraction (`kyc-provider` interface), with a reference adapter for a hosted anchor (e.g. a Stellar Ecosystem anchor) that collects and stores KYC data. No enforcement yet. | Before mainnet launch |
| **Phase 2 — originator onboarding** | Enforce KYC for **invoice originators** before they can register invoices above a small de-minimis threshold. Lenders remain permissionless. Uses SEP-12 `KYC_SERVER` + `customer` endpoints; status cached on-chain as an attestation (hash of provider record), never raw PII. | Mainnet launch (first 90 days) |
| **Phase 3 — sanction & jurisdiction screening** | Screen wallet addresses and jurisdictions against sanctions lists (OFAC / EU consolidated list) at onboarding and continuously for existing participants. Jurisdictions on the launch blocklist are refused at the product layer. | Mainnet launch + 90 days |
| **Phase 4 — lender verification (threshold-based)** | Above a cumulative lender volume threshold, require the same SEP-12 onboarding. Keeps the protocol accessible for small retail lenders while satisfying AML expectations for larger flows. | Mainnet + 6 months |

**Design constraints for the KYC layer:**

- **No PII on-chain.** SEP-12 records stay with the anchor/provider. The
  contract layer only ever sees an opaque attestation (provider ID + hash +
  expiry), so on-chain data remains GDPR/CCPA-light.
- **The core contracts stay KYC-free.** Enforcing KYC at the contract level
  would make the protocol globally non-permissionless. Enforcement happens at
  the product/UI layer and, if ever needed, through the admin blacklist
  (`blacklist_address`) for sanctioned addresses.
- **User-side wallets are unaffected.** SEP-12 is an anchor-to-wallet
  protocol; our implementation only adds an optional step in the frontend
  onboarding flow.

---

## 3. Jurisdictions Avoided at Launch

The following jurisdictions are **not** targeted at launch. Users from these
jurisdictions may be refused service at the product layer (and may be
blacklisted on-chain if a sanctioned address is identified):

| Jurisdiction | Reason |
|---|---|
| **United States** | Tokenized lending, token transferability, and state money-transmitter / lending licensing create a fragmented and high-ambiguity regime. We are not licensed in any US state. The protocol is built on Stellar but deliberately does not target US users at launch. |
| **EU (pre-MiCA-clearance)** | Markets in Crypto-Assets Regulation (MiCA) transitional rules are still settling for lending protocols and asset-referenced tokens; onboarding EU users before the regime clarifies is deferred. |
| **High-risk / sanctioned jurisdictions** | Any country on the FATF high-risk list or subject to OFAC/EU/UN sanctions. Sanctions compliance is non-negotiable and global in effect — participation from these jurisdictions is blocked regardless of the launch list. |

This list is a **living document** — it will be updated as counsel reviews,
as MiCA guidance firms up, and before any mainnet launch.

---

## 4. Why the Current Offer/Lender Flows Are Not Structured as Securities

This section explains the *current, shipped design* (testnet; direct
originator–lender loans; fixed-rate, fixed-term debt; a non-tradable-by-
design position token). It is an engineering/design analysis, not a legal
opinion.

### 4.1 The transaction is a direct, bilateral loan

- A lender and an originator enter a **one-to-one loan agreement**: the lender
  funds a *specific, identified invoice* at a *fixed interest rate* for a
  *fixed duration*.
- There is **no pooling** of lender funds, **no common enterprise** in the
  Howey sense, and **no shared profits**. Each lender's return is a
  predetermined interest payment owed by the borrower — not a share of a
  venture's profits.

### 4.2 No reliance on the efforts of others for profits

- The borrower's repayment obligation is a **contractual debt**, not a
  return generated by the protocol's or any promoter's efforts. The
  "efforts of others" prong of the Howey test is not satisfied: the lender's
  entitlement is fixed at signing and does not vary with anything the
  protocol team does.

### 4.3 The position token is a claim record, not a security

- On acceptance, the lender receives a **SEP-41 position token** minted 1:1
  with their principal. It records *which invoice the lender has funded* and
  is a bookkeeping claim on a specific receivable.
- The current design includes **no secondary-market venue, no DEX
  listing, no orderbook, no yield farming, and no fractionalization of
  pooled assets**. Transfer of the position token is a simple transfer of the
  underlying claim (like transferring a receivable), not a trade on a
  market in "investment contracts."
- The token confers **no governance, no equity, and no profit-participation**
  rights.

### 4.4 Instrument characteristics

| Characteristic | Current design |
|---|---|
| Instrument type | Fixed-rate, fixed-term debt (invoice financing) |
| Counterparty | Single, identified borrower per loan |
| Return | Fixed interest, owed by the borrower |
| Pooling / common enterprise | None |
| Passive-income / promoter effort | None — return is contractually fixed |
| Secondary market | None built (transfer form only, Task 8) |
| Token rights | Claim record only — no governance/equity |

### 4.5 What would change the analysis (and therefore requires counsel)

The conclusion above rests on the *current* facts. Any of the following
future features would require a fresh legal review before shipping:

- Lending **pools** where lender returns depend on aggregate portfolio
  performance (common enterprise / Howey risk increases materially);
- **Yield paid to insurance-pool stakers** (passive income in exchange for
  funds — "investment contract" risk);
- A **secondary trading marketplace** or DEX integration for position tokens;
- **Fractionalizing** invoices across multiple token holders;
- US user onboarding or any US marketing.

---

## 5. Operational Notes

- **Not an exchange:** InvoFi is a peer-to-peer financing protocol; it does
  not operate an order book, take custody, or match third-party buyers/sellers
  for a fee.
- **Not a custodian:** users control their own keys; the contracts hold funds
  only transiently within individual transactions.
- **Auditability:** all protocol actions are public Stellar transactions —
  see `docs/security-self-review.md` (invofi-contracts) for the engineering
  self-review, and the [SECURITY.md](./SECURITY.md) disclosure policy.
