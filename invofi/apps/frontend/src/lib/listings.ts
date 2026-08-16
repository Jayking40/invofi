// ── Secondary-market position listings (ADR-0004) ────────────────────────────
// Discovery only. A listing advertises a position holder's intent to sell:
// invoice reference, tokens offered, asking price. InvoFi never escrows the
// token or the payment — settlement is a plain SEP-41 transfer the seller
// signs from /portfolio, after which they mark the listing Settled.
import { z } from 'zod';
import { supabase } from './supabase';
import { formatAmount, toStroopsBigInt } from './utils';
import type { Currency, FinancingOffer, PositionListing, PositionListingStatus } from '@/types';

export const LISTING_NOTE_MAX = 280;

/** Offer statuses that represent a live position a lender can sell. */
const SELLABLE_OFFER_STATUSES: string[] = ['Accepted', 'Financed'];

const decimalAmount = (label: string) =>
  z
    .string()
    .regex(/^\d+(\.\d{1,7})?$/, `Enter a valid ${label} (e.g. 1000.00)`)
    .refine(v => toStroopsBigInt(v) > 0n, `${label[0].toUpperCase()}${label.slice(1)} must be greater than zero`);

export const listingDraftSchema = z.object({
  offerId: z.string().min(1, 'Select the position you want to list'),
  tokenAmount: decimalAmount('token amount'),
  askingPrice: decimalAmount('asking price'),
  priceCurrency: z.enum(['XLM', 'USDC']),
  note: z.string().max(LISTING_NOTE_MAX, `Keep the note under ${LISTING_NOTE_MAX} characters`),
});

export type ListingDraft = z.infer<typeof listingDraftSchema>;

export type ListingSortKey = 'newest' | 'price_asc' | 'price_desc' | 'amount_desc';

export const LISTING_SORT_OPTIONS: { value: ListingSortKey; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Asking price: low to high' },
  { value: 'price_desc', label: 'Asking price: high to low' },
  { value: 'amount_desc', label: 'Position size: largest' },
];

export const LISTING_STATUS_COLORS: Record<PositionListingStatus, string> = {
  Open:      'bg-blue-100 text-blue-800 border-blue-200',
  Settled:   'bg-green-100 text-green-800 border-green-200',
  Withdrawn: 'bg-gray-100 text-gray-600 border-gray-200',
};

export interface ListingFilters {
  search: string;
  currency: Currency | 'ALL';
}

/**
 * Free-text + currency filter over listings. Search matches the invoice
 * reference, the seller address, and the originating offer id — the three
 * identifiers a lender would paste in to find a specific position.
 */
export function filterListings(listings: PositionListing[], filters: ListingFilters): PositionListing[] {
  const q = filters.search.trim().toLowerCase();
  return listings.filter(l => {
    if (filters.currency !== 'ALL' && l.price_currency !== filters.currency) return false;
    if (!q) return true;
    return (
      l.invoice_id.toLowerCase().includes(q) ||
      l.seller.toLowerCase().includes(q) ||
      (l.offer_id ?? '').toLowerCase().includes(q)
    );
  });
}

/** Compares stroop amounts without losing precision on large positions. */
function compareStroops(a: string, b: string): number {
  const left = toStroopsBigInt(a);
  const right = toStroopsBigInt(b);
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function sortListings(listings: PositionListing[], sort: ListingSortKey): PositionListing[] {
  return [...listings].sort((a, b) => {
    switch (sort) {
      case 'price_asc':
        return compareStroops(a.asking_price, b.asking_price);
      case 'price_desc':
        return compareStroops(b.asking_price, a.asking_price);
      case 'amount_desc':
        return compareStroops(b.token_amount, a.token_amount);
      case 'newest':
      default:
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    }
  });
}

/**
 * Asking price per position token, for comparing listings of different sizes.
 * Display-only — `null` when the listing has a zero/unparseable size.
 */
export function unitPrice(listing: PositionListing): string | null {
  const tokens = Number(toStroopsBigInt(listing.token_amount));
  if (!tokens) return null;
  const price = Number(toStroopsBigInt(listing.asking_price));
  return (price / tokens).toFixed(4);
}

/** All listings, newest first. RLS makes these world-readable (discovery). */
export async function fetchListings(): Promise<PositionListing[]> {
  const { data, error } = await supabase
    .from('position_listings')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as PositionListing[]) ?? [];
}

/** The lender's live positions — the only things they may list for sale. */
export async function fetchSellablePositions(lenderId: string): Promise<FinancingOffer[]> {
  const { data, error } = await supabase
    .from('financing_offers')
    .select('*')
    .eq('lender_id', lenderId)
    .in('status', SELLABLE_OFFER_STATUSES)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as FinancingOffer[]) ?? [];
}

/**
 * A listing may not offer more tokens than the position holds: position tokens
 * are minted 1:1 with principal (ADR-0002), so the financing offer's principal
 * is the ceiling. Returns an error message, or null when the draft is sound.
 *
 * This is the one holding check the app can make deterministically from
 * mirrored on-chain data. It is not proof the seller still holds the tokens —
 * buyers verify the balance on-chain before settling (ADR-0004).
 */
export function checkListingSize(tokenAmount: string, offer: FinancingOffer): string | null {
  const requested = toStroopsBigInt(tokenAmount);
  const principal = toStroopsBigInt(offer.amount);
  if (requested > principal) {
    return `That position is only worth ${formatAmount(principal)} position tokens.`;
  }
  return null;
}

export interface CreateListingInput {
  draft: ListingDraft;
  offer: FinancingOffer;
  seller: string;
  sellerId: string;
}

/** Publishes an ask. The row is an advertisement — nothing is escrowed. */
export async function createListing({
  draft,
  offer,
  seller,
  sellerId,
}: CreateListingInput): Promise<PositionListing> {
  const { data, error } = await supabase
    .from('position_listings')
    .insert({
      seller,
      seller_id: sellerId,
      invoice_id: offer.invoice_id,
      offer_id: offer.id,
      token_amount: draft.tokenAmount,
      asking_price: draft.askingPrice,
      price_currency: draft.priceCurrency,
      status: 'Open',
      note: draft.note.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as PositionListing;
}

/**
 * Explicit invalidation: the seller closes their own listing once the transfer
 * clears (Settled) or changes their mind (Withdrawn). Listings are never
 * auto-closed from balance deltas — see ADR-0004.
 */
export async function setListingStatus(
  id: string,
  status: PositionListingStatus,
): Promise<PositionListing> {
  const { data, error } = await supabase
    .from('position_listings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as PositionListing;
}
