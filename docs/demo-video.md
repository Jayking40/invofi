# Demo Video — Shot List & Production Notes

> **This is a human-track deliverable** — recording and uploading are done
> by the maintainer; this document is the full recording script. Target:
> **3–5 minutes**, uploaded **unlisted** to YouTube, then linked from both
> READMEs (invofi + invofi-contracts).
>
> **Environment check (verified 2026-08-06):** live app returns HTTP 200 on
> `/` and `/stats`; Soroban testnet is up (protocol 27, Friendbot available);
> the 5 contracts + POS token are deployed. You can record right now.

---

## Before you record

- [ ] Use a **fresh funded testnet account** for the business and one for the
      lender (Freighter can create testnet accounts; fund via Friendbot —
      enabled on testnet as of this doc).
- [ ] Have **Freighter installed + connected** on the recording browser.
- [ ] Confirm the app points at the live testnet contracts (it does — the
      Vercel deployment is configured).
- [ ] **Check `/stats` in a browser first.** If it shows zeros/empty state,
      that's expected until the indexer's Supabase secrets are configured —
      the shot still works, but you may prefer to add the secrets first so
      real aggregates show.
- [ ] Close all tabs except the app; hide bookmarks bar; disable notifications.
- [ ] Recording quality: 1080p, mic on, cursor highlighted, no auto-pausing.

---

## Shot list with narration (≈ 4 minutes)

Read the lines under each shot. Feel free to trim — these are guides, not a
script to memorize.

| # | Time | Scene | Narration |
|---|---|---|---|
| 1 | 0:00–0:20 | **Intro** (landing page) | "InvoFi is open-source invoice financing on Stellar Soroban. Small businesses often wait 30 to 90 days to get paid. InvoFi lets them tokenise an invoice on-chain and get funded by a global pool of lenders — no banks, no middlemen." |
| 2 | 0:20–0:45 | **Connect wallet** | Click **Connect Wallet**, pick **Freighter** (mention LOBSTR is equally supported via the approved-wallet allowlist). Approve. "One click, and my Stellar wallet is connected." |
| 3 | 0:45–1:20 | **Register an invoice** | Business flow: fill amount + currency (XLM) + due date, submit. "The invoice is now registered on-chain — let's open the registry contract on stellar.expert to show the entry." (Show the registry contract link.) |
| 4 | 1:20–1:55 | **Lender creates an offer** | Switch to the lender wallet; Marketplace → find the invoice → create offer with an interest rate + duration. "Any lender can now compete with a financing offer." |
| 5 | 1:55–2:30 | **Accept offer — real token transfer** | Business accepts. **Key moment.** "Watch this: the XLM actually moves from the lender to the business in this transaction — and the lender receives a SEP-41 position token, one per unit of principal." (Show the stellar.expert transaction and the invoice flipping to **Financed**.) |
| 6 | 2:30–2:55 | **Position token transfer** | Lender portfolio: add the POS trustline (one click), then **Transfer Position** to a second wallet. "Position tokens are plain Stellar assets — I can send my claim to any wallet." |
| 7 | 2:55–3:30 | **Repay** | Business repays (partial or full). "The business repays principal plus interest — watch the remaining balance update — and the invoice reaches Repaid. The lender just earned yield." |
| 8 | 3:30–3:55 | **Stats dashboard** | `/stats` page. "Every action publishes an on-chain event, and an indexer aggregates them here: invoices financed, total volume, repayment rate, active lenders, and the insurance pool." |
| 9 | 3:55–4:10 | **Outro** | Show repo cards. "InvoFi is open source — apps and docs in the invofi repo, the auditable smart contracts in invofi-contracts. Contributions welcome." |

---

## After recording

- [ ] Trim to 3–5 min; add captions (YouTube auto-captions, corrected).
- [ ] Upload **unlisted**: "InvoFi — Testnet Demo (Aug 2026)".
- [ ] Copy the YouTube URL and send it to the maintainer chat — the README
      links are added the moment the URL is available:
      `- 🎬 [Demo video](<youtube-url>) — 4-minute testnet walkthrough.`
      (added to the **Security/Compliance** area of the invofi README and the
      **Changelog** area of the invofi-contracts README)
