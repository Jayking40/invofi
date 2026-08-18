// Contract shapes are owned by @invofi/sdk (Task 15 / ADR-0003) — re-export
// here so every component keeps importing from '@/types' with one source of
// truth. App-only types (profiles, wallet state) stay local.
export type {
  Currency,
  FinancingOffer,
  Invoice,
  InvoiceStatus,
  OfferStatus,
} from '@invofi/sdk';

import type { Currency } from '@invofi/sdk';
import type { DocumentMimeType } from '@/lib/documents/validation';
import type { DocumentStatus } from '@/lib/documents/status';

export type UserRole = 'business' | 'lender';

/**
 * An invoice proof document attached by the originator and verified by
 * lenders (issue #222). Bytes live on IPFS; this row is the access-controlled
 * index (CID + SHA-256 hash + verification state).
 */
export interface InvoiceDocument {
  id: string;
  invoice_id: string;
  uploader_id: string;
  file_name: string;
  mime_type: DocumentMimeType;
  file_size: number;
  ipfs_cid: string;
  /** SHA-256 hex digest of the file bytes, for tamper detection. */
  document_hash: string;
  status: DocumentStatus;
  verification_comment: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
}

export type PositionListingStatus = 'Open' | 'Settled' | 'Withdrawn';

/**
 * A secondary-market ask for position tokens (ADR-0004).
 *
 * Discovery only: the row advertises a holder's intent to sell. InvoFi never
 * escrows the token or the payment — settlement is a plain SEP-41 transfer the
 * seller signs, after which they mark the listing Settled. Listings are
 * off-chain by design, so the shape lives here rather than in @invofi/sdk
 * (which owns contract shapes).
 */
export interface PositionListing {
  id: string;
  /** Stellar address holding the position tokens. */
  seller: string;
  seller_id: string | null;
  /** Invoice reference — the receivable the position is a claim on. */
  invoice_id: string;
  /** Financing offer the position came from, when known. */
  offer_id: string | null;
  /** Position tokens offered, human units (mirror convention, e.g. "1000.00"). */
  token_amount: string;
  /** What the seller is asking, human units. */
  asking_price: string;
  price_currency: Currency;
  status: PositionListingStatus;
  note: string | null;
  created_at: string;
  updated_at?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  wallet_address: string | null;
  display_name: string | null;
  created_at: string;
}

export interface WalletState {
  publicKey: string | null;
  walletId: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isInstalled: boolean;
  networkMismatch: boolean;
}

// Matching engine types (lender preferences, scores, quality)
export type {
  RiskProfile,
  CurrencyPreference,
  LenderPreferences,
  LenderPreferencesSerialized,
  MatchQuality,
  MatchResult,
  OriginatorHistory,
  ScoreBreakdown,
} from './matching';
export { DEFAULT_PREFERENCES, serializePreferences, deserializePreferences } from './matching';
