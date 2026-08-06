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

export type UserRole = 'business' | 'lender';

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
