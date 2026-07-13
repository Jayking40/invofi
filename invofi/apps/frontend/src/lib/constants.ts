export const STELLAR_NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';

export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://soroban-testnet.stellar.org';
export const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';
export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID ?? '';

// Stellar Expert explorer — network-aware deep links for contracts, txs, accounts
export const EXPLORER_BASE =
  STELLAR_NETWORK === 'mainnet'
    ? 'https://stellar.expert/explorer/public'
    : 'https://stellar.expert/explorer/testnet';

export const explorerContractUrl = (contractId: string) => `${EXPLORER_BASE}/contract/${contractId}`;
export const explorerTxUrl = (hash: string) => `${EXPLORER_BASE}/tx/${hash}`;
export const explorerAccountUrl = (address: string) => `${EXPLORER_BASE}/account/${address}`;

export const USDC_ISSUER_TESTNET = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
export const XLM_DECIMALS = 7;
export const STROOPS_PER_XLM = 10_000_000;

export const INVOICE_STATUSES = ['Pending', 'Financed', 'Repaid', 'Overdue', 'Cancelled'] as const;
export const OFFER_STATUSES = ['Pending', 'Accepted', 'Repaid', 'Rejected', 'Defaulted'] as const;
export const CURRENCIES = ['XLM', 'USDC'] as const;
export const USER_ROLES = ['business', 'lender'] as const;

// Must match GRACE_PERIOD_SECS in invofi/apps/contracts/lib.rs — how long
// after due_date a Financed offer stays reclaimable-pending before a lender
// can mark it Defaulted.
export const GRACE_PERIOD_SECS = 604_800; // 7 days

export const RISK_TIERS = {
  A: { label: 'Low Risk', color: 'green', baseRate: 500 },
  B: { label: 'Medium Risk', color: 'yellow', baseRate: 800 },
  C: { label: 'High Risk', color: 'red', baseRate: 1200 },
} as const;

export const QUERY_STALE_TIME = 30_000;
export const QUERY_GC_TIME = 5 * 60_000;
