# ADR-0004: Secondary-market discovery for position tokens

**Status:** Accepted (2026-08-16)

## Context

Task 8 shipped position-token **transfer**: a lender who funded an invoice
holds a SEP-41 position token (1 token = 1 base unit of principal, ADR-0002)
and can send it to any Stellar address from `/portfolio`. What it did not ship
is **discovery** — a lender who wants to exit a position has no way to say so,
and a lender who wants to buy one has no way to find it. Today the two parties
have to already know each other.

The roadmap lists "secondary-market browsing/discovery for position tokens" as
future scope. This ADR fixes the model for that scope *before* the UI is built,
because the choice has compliance consequences (§ Compliance below): a venue
that matches buyers and sellers, holds tokens, or takes a fee is a materially
different thing from a board where holders publish an asking price.

Three options were on the table for where a listing lives:

1. **A listing contract on Soroban** — listings are contract state; a `list`
   call escrows the position token until sale or cancellation.
2. **Event-sourced listings** — a thin contract emits `listed` / `unlisted`
   events, no escrow; the frontend replays events through the indexer.
3. **An off-chain listing index** — listings are rows in the existing Supabase
   mirror; nothing about them touches a contract.

## Decision

1. **Listings are off-chain records, in the existing Supabase mirror**
   (option 3). A listing is an *advertisement of intent to sell*, not an
   instrument and not an escrow. Table `position_listings` (schema in
   [docs/06-supabase.md](../06-supabase.md)), one row per offered position.

2. **The minimal listing schema is:**

   | Field | Meaning |
   |---|---|
   | `seller` | Stellar address that holds the position tokens |
   | `seller_id` | Supabase user that owns the row (RLS subject) |
   | `invoice_id` | **Invoice reference** — the receivable the position is a claim on |
   | `offer_id` | The financing offer the position came from (nullable) |
   | `token_amount` | Position tokens offered, human units |
   | `asking_price` + `price_currency` | **Asking price** the seller wants, XLM or USDC |
   | `status` | `Open` → `Settled` \| `Withdrawn` |
   | `note` | Free-text terms from the seller (≤ 280 chars) |

3. **Settlement stays a plain SEP-41 transfer.** The marketplace never holds
   the token, never holds the payment, never matches counterparties, and takes
   no fee. A buyer contacts the seller out of band; the seller sends the tokens
   with the existing `/portfolio` transfer form, which the listing links to
   with the amount prefilled. Payment for the position happens entirely outside
   InvoFi.

4. **A listing is seller-attested, and the UI says so.** Because there is no
   escrow, an `Open` listing is not proof the seller still holds the tokens.
   Every listing card links the seller's account on Stellar Expert so a buyer
   verifies the balance on-chain before paying. The one check the app *can*
   make cheaply and deterministically it does make: a listing may not offer
   more tokens than the principal of the financing offer it references
   (1 token = 1 base unit of principal), which is mirrored from chain.

5. **Invalidation is explicit, not inferred.** After the transfer clears, the
   seller marks the listing `Settled`; they can `Withdraw` it at any time.
   We deliberately do not auto-close listings by watching balances: a partial
   transfer, a transfer to the seller's own second wallet, and a sale are
   indistinguishable from balance deltas alone, and a wrong auto-close is worse
   than a stale row a buyer can verify.

## Alternatives considered

- **Listing contract with escrow (option 1)** — rejected. Escrow makes InvoFi a
  custodian for the duration of every listing and turns settlement into a
  contract-mediated trade; both are exactly the facts § 4 of
  [compliance.md](../compliance.md) relies on *not* being true. It also needs a
  new audited contract for what is, at this stage, a bulletin board.
- **Event-sourced listings (option 2)** — rejected *for now*, not on principle.
  It keeps discovery non-custodial and censorship-resistant, but costs a
  contract deploy plus an indexer path, and the RPC event-retention window
  (~5 days, ADR-0002) means listings older than that need an off-chain store
  anyway. Revisit if listings need to be readable without InvoFi's frontend.
- **Contracts return a list of open listings** — rejected for the same reason
  as ADR-0002: Soroban reads must not return unbounded lists.

## Compliance

A visible asking price plus a browse surface is the point where a position
token starts to look like a tradable instrument, so § 4 of
[compliance.md](../compliance.md) was re-read against this design before it was
built, and § 4.6 was added to record the review. The constraints that keep the
existing analysis intact are **normative for this feature**:

- no custody of tokens or funds, at any point;
- no matching engine, order book, or auction — listings are one-sided asks;
- no fee, spread, or rake on a settlement;
- no price index, chart, or aggregate "market price" published by InvoFi;
- no fractionalizing of a position across buyers by the protocol;
- settlement remains a bilateral SEP-41 transfer the seller signs.

If a future change breaks any of those, the securities analysis has to be
re-run with counsel before it ships — § 4.5 already lists "a secondary trading
marketplace" as a trigger, and this ADR's whole point is to stay on the
discovery side of that line.

## Consequences

- Lenders can publish and browse positions today with no new contract, no
  audit dependency, and no custody.
- Listings are only as trustworthy as the seller; buyers must verify on-chain
  balances themselves. This is documented in the UI, not hidden.
- Listing data lives in Supabase, so it is not readable from chain and is lost
  if the mirror is lost. Acceptable — a listing is an advertisement, while the
  position itself (the only thing with value) is on-chain and unaffected.
- `position_listings` needs a one-time SQL setup with RLS
  (see [docs/06-supabase.md](../06-supabase.md)).
