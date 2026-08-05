export type InvoiceStatus = 'Pending' | 'Financed' | 'Repaid' | 'Overdue' | 'Cancelled' | 'Disputed' | 'Defaulted';
export type OfferStatus = 'Pending' | 'Accepted' | 'Financed' | 'Rejected' | 'Repaid' | 'Defaulted';
export type UserRole = 'business' | 'lender';
export type Currency = 'XLM' | 'USDC';

export interface Invoice {
  id: string;
  originator: string;
  amount: bigint;
  currency: Currency;
  due_date: number;
  status: InvoiceStatus;
  /** ISO timestamp from the Supabase mirror; absent on pure on-chain reads */
  created_at?: string;
}

export interface FinancingOffer {
  id: string;
  invoice_id: string;
  lender: string;
  amount: bigint;
  currency: Currency;
  interest_rate: number;
  duration: number;
  /** Running total of stroops repaid so far (mirrors the contract's FinancingOffer.amount_repaid). */
  amount_repaid: bigint;
  status: OfferStatus;
  funded_at: number;
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
