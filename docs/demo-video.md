# Demo Video — Shot List & Production Notes (Task 20)

> **Task 20 is a human-track deliverable** — no code changes. This document is
> the recording script. Target: **3–5 minutes**, uploaded **unlisted** to
> YouTube, then linked from both READMEs (invofi + invofi-contracts).
> Record against the live testnet deployment; the `/stats` page should be
> visible per Task 14's DoD.

---

## Before you record

- [ ] Use a **fresh funded testnet account** for the business and one for the
      lender (Freighter can create testnet accounts; fund via Friendbot).
- [ ] Have **Freighter installed + connected** on the recording browser.
- [ ] Confirm the app points at the live testnet contracts
      (`NEXT_PUBLIC_*_CONTRACT_ID` set in `.env.local` / Vercel).
- [ ] Pick a quiet window so `/stats` aggregates update between shots if needed.
- [ ] Close all tabs except the app; hide bookmarks bar; disable notifications.
- [ ] Recording quality: 1080p, mic on, cursor highlighted, no auto-pausing.

---

## Shot list (≈ 4 minutes)

| # | Time | Scene | What to say / show |
|---|---|---|---|
| 1 | 0:00–0:20 | **Intro** | Landing page. "InvoFi is open-source invoice financing on Stellar Soroban — businesses tokenise invoices and get funded by a global pool of lenders, no banks." |
| 2 | 0:20–0:45 | **Connect wallet** | Click **Connect Wallet**, pick **Freighter** (mention LOBSTR is equally supported — approved-wallet allowlist). Approve the connection. |
| 3 | 0:45–1:20 | **Register an invoice** | Business flow: create invoice, amount + currency (XLM), due date. Point out it's registered **on-chain** — open the registry contract on stellar.expert to show the entry. |
| 4 | 1:20–1:55 | **Lender creates an offer** | Switch to the lender wallet, open Marketplace, find the invoice, submit an offer with an interest rate and duration. |
| 5 | 1:55–2:30 | **Accept offer — real token transfer** | Business accepts. **Key moment:** show the XLM actually moved lender → business (stellar.expert txn), the invoice flipping to **Financed**, and the **POS position token** minted to the lender. |
| 6 | 2:30–2:55 | **Position token transfer** | Lender portfolio: add the POS trustline (one click), then **Transfer Position** to a second wallet address and show it land. |
| 7 | 2:55–3:30 | **Repay** | Business repays (partial or full) — show the **remaining balance** updating, then the invoice reaching **Repaid** and the lender receiving principal + interest. |
| 8 | 3:30–3:55 | **Stats dashboard** | `/stats` — show invoices financed, volume, repayment rate, active lenders, insurance pool. |
| 9 | 3:55–4:10 | **Outro** | Repo cards: [invofi](https://github.com/Stellar-VaultLink/invofi) + [invofi-contracts](https://github.com/Stellar-VaultLink/invofi-contracts), docs, compliance posture, open-source CTA. |

---

## After recording

- [ ] Trim to 3–5 min; add captions (YouTube auto-captions, corrected).
- [ ] Upload **unlisted**: "InvoFi — Testnet Demo (Aug 2026)".
- [ ] Add one line to **both READMEs**:
      `- 🎬 [Demo video](<youtube-url>) — 4-minute testnet walkthrough.`
- [ ] Share the link with Drips Wave 8 review + SCF application (Task 21).
