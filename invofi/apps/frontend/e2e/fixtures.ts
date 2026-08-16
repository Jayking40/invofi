import { type Page } from '@playwright/test';
import { nativeToScVal, SorobanDataBuilder } from '@stellar/stellar-sdk';

/**
 * Shared fixtures for the InvoFi e2e smoke suite.
 *
 * The app has two external dependencies — Supabase (auth + the invoice/offer
 * mirror) and the Soroban RPC (on-chain reads). The smoke tests stub both at
 * the HTTP boundary so the suite is deterministic and needs no real Supabase
 * credentials, while still running against the live testnet contracts for the
 * account lookup the SDK performs before a simulated read.
 */

export const SUPABASE_URL = 'https://e2e.supabase.co';
export const RPC_URL = 'https://soroban-testnet.stellar.org';

/**
 * The auth storage key @supabase/ssr derives for `SUPABASE_URL`:
 * `sb-<first-hostname-label>-auth-token` → `sb-e2e-auth-token`.
 */
const AUTH_STORAGE_KEY = 'sb-e2e-auth-token';

/** A real, funded Stellar testnet account used as the fixture originator. */
export const ORIGINATOR = 'GCHVSUK5XKL44CSZ3WGI2W2OZCC7SXZMM5B34TCOQ2YNEGPNP3BLOVMT';

/**
 * Invoice status as the live Soroban contract actually serializes it — the
 * u32 discriminant, NOT the string the Supabase mirror stores. Verified
 * against testnet: `status` decodes to 0..4.
 */
export const InvoiceStatus = {
  Pending: 0,
  Financed: 1,
  Repaid: 2,
  Overdue: 3,
  Cancelled: 4,
} as const;

/** Shape of an invoice as returned by the on-chain `get_invoice` read. */
export interface OnChainInvoice {
  id: string;
  originator: string;
  /** i128 stroops */
  amount: bigint;
  currency: 'XLM' | 'USDC';
  /** u64 unix seconds */
  due_date: bigint;
  status: number;
}

/** Shape of an invoice as stored in the Supabase mirror. */
export interface MirrorInvoice {
  id: string;
  originator: string;
  /** Human-unit decimal string, e.g. "10000.00" (mirror convention). */
  amount: string;
  currency: 'XLM' | 'USDC';
  /** ISO timestamp string (mirror convention). */
  due_date: string;
  status: 'Pending' | 'Financed' | 'Overdue' | 'Repaid' | 'Cancelled' | 'Defaulted';
  created_at: string;
}

export const SMOKE_INVOICE: OnChainInvoice = {
  id: 'inv_smoke_demo',
  originator: ORIGINATOR,
  amount: 20_000_000n, // 2 XLM
  currency: 'XLM',
  due_date: 2_000_000_000n,
  status: InvoiceStatus.Pending,
};

export const SMOKE_INVOICES: MirrorInvoice[] = [
  {
    id: 'inv_smoke_market_1',
    originator: ORIGINATOR,
    amount: '10000.00',
    currency: 'XLM',
    due_date: '2027-01-01T00:00:00.000Z',
    status: 'Pending',
    created_at: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'inv_smoke_market_2',
    originator: ORIGINATOR,
    amount: '2500000.00',
    currency: 'USDC',
    due_date: '2027-02-01T00:00:00.000Z',
    status: 'Financed',
    created_at: '2026-08-02T00:00:00.000Z',
  },
];

/** A Supabase user the app sees for the authenticated smoke flows. */
export const SMOKE_USER = {
  id: '00000000-0000-4000-8000-0000000000e2',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'lender@e2e.test',
  email_confirmed_at: '2026-08-01T00:00:00.000Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { role: 'lender', display_name: 'E2E Lender' },
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
};

// ── Session seeding ─────────────────────────────────────────────────────────

/**
 * Encodes a Supabase session the way @supabase/ssr persists it: a cookie named
 * `<storage-key>` whose value is `base64-` + base64url(JSON.stringify(session)).
 */
function encodeSessionCookie(session: object): string {
  return `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
}

/**
 * Seeds a signed-in Supabase session and stubs the `/auth/v1/user` endpoint
 * `getUser()` calls, so `AuthGuard` sees a valid session without any real
 * Supabase project.
 */
export async function mockSupabaseAuth(page: Page): Promise<void> {
  const session = {
    access_token: 'e2e-dummy-access-token',
    refresh_token: 'e2e-dummy-refresh-token',
    token_type: 'bearer',
    // Far enough in the future that auth-js never attempts a refresh mid-test.
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    expires_in: 3600,
    user: SMOKE_USER,
  };

  await page.context().addCookies([
    {
      name: AUTH_STORAGE_KEY,
      value: encodeSessionCookie(session),
      url: 'http://localhost:3000',
    },
  ]);

  await page.route('**/auth/v1/user', (route) =>
    route.fulfill({ json: SMOKE_USER }),
  );
}

// ── Supabase REST mirror mocks ───────────────────────────────────────────────

/** Stubs the invoice / offer mirror reads the marketplace and detail pages use. */
export async function mockSupabaseMirror(
  page: Page,
  data: { invoices?: MirrorInvoice[]; offers?: object[] } = {},
): Promise<void> {
  await page.route('**/rest/v1/invoices**', (route) =>
    route.fulfill({ json: data.invoices ?? SMOKE_INVOICES }),
  );
  await page.route('**/rest/v1/financing_offers**', (route) =>
    route.fulfill({ json: data.offers ?? [] }),
  );
}

// ── Soroban RPC mock (on-chain invoice read) ────────────────────────────────

/**
 * Builds the ScVal for an invoice exactly as the live contract returns it
 * (verified against testnet): a map of symbol-keyed fields with amount=i128,
 * due_date=u64, status=u32.
 */
function invoiceScVal(invoice: OnChainInvoice) {
  return nativeToScVal(
    {
      id: invoice.id,
      originator: invoice.originator,
      amount: invoice.amount,
      currency: invoice.currency,
      due_date: invoice.due_date,
      status: invoice.status,
    },
    {
      type: {
        id: ['symbol', 'symbol'],
        originator: ['symbol', 'address'],
        amount: ['symbol', 'i128'],
        currency: ['symbol', 'symbol'],
        due_date: ['symbol', 'u64'],
        status: ['symbol', 'u32'],
      },
    },
  );
}

/**
 * Stubs `simulateTransaction` responses for the Soroban RPC so `get_invoice`
 * returns `invoice` deterministically. Other RPC calls (the account lookup the
 * SDK does before a simulated read) fall through to real testnet.
 */
export async function mockInvoiceRead(page: Page, invoice: OnChainInvoice): Promise<void> {
  await page.route(`**${RPC_URL}/**`, async (route) => {
    let method: unknown;
    try {
      method = (route.request().postDataJSON() as { method?: unknown } | null)?.method;
    } catch {
      // Non-JSON RPC request — let it through to testnet.
      return route.fallback();
    }
    if (method !== 'simulateTransaction') {
      return route.fallback();
    }

    const result = {
      transactionData: new SorobanDataBuilder().build().toXDR('base64'),
      minResourceFee: '100',
      results: [{ auth: [], xdr: invoiceScVal(invoice).toXDR('base64') }],
      events: [],
      latestLedger: 5_000_000,
    };

    return route.fulfill({
      json: { jsonrpc: '2.0', id: 1, result },
    });
  });
}

/**
 * One-call setup for the authenticated smoke flows: a signed-in Supabase
 * session plus the mirror and (optionally) on-chain mocks.
 */
export async function authenticate(
  page: Page,
  options: { invoice?: OnChainInvoice; invoices?: MirrorInvoice[]; offers?: object[] } = {},
): Promise<void> {
  await mockSupabaseAuth(page);
  await mockSupabaseMirror(page, options);
  if (options.invoice) {
    await mockInvoiceRead(page, options.invoice);
  }
}
