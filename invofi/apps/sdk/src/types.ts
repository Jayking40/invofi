// ── Core protocol types (single source of truth — Task 15) ──────────────────
// These mirror the Rust structs in invofi-contracts (common/src/lib.rs).
// The frontend re-exports these from `@invofi/sdk` so contract shapes are
// defined in exactly one place.

export type InvoiceStatus =
  | 'Pending'
  | 'Financed'
  | 'Repaid'
  | 'Overdue'
  | 'Cancelled'
  | 'Disputed'
  | 'Defaulted';

export type OfferStatus =
  | 'Pending'
  | 'Accepted'
  | 'Financed'
  | 'Rejected'
  | 'Repaid'
  | 'Defaulted';

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
