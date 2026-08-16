import { test, expect } from '@playwright/test';
import {
  ORIGINATOR,
  SMOKE_LISTINGS,
  SMOKE_POSITION_OFFER,
  SMOKE_USER,
  authenticate,
  mockPositionListings,
  mockUserProfile,
} from './fixtures';

/**
 * Secondary-market discovery for position tokens (ADR-0004).
 *
 * These drive the real /marketplace/positions route end to end: the browse
 * board, the publish form (a real POST to `position_listings`), the
 * over-listing guard, and seller-side invalidation. Only the Supabase HTTP
 * boundary is stubbed — every filter, sort, and validation runs the app's own
 * code path.
 */
test.describe('position listings', () => {
  test('browse: a lender finds, filters, and sorts listed positions', async ({ page }) => {
    await authenticate(page);
    await mockPositionListings(page, SMOKE_LISTINGS);

    await page.goto('/marketplace/positions');

    await expect(page.getByRole('heading', { name: 'Position Listings' })).toBeVisible();

    const cards = page.getByTestId('position-listing');
    await expect(cards).toHaveCount(2);

    // Asking price + invoice reference — the two fields the listing model exists for.
    await expect(page.getByText('9500.00 XLM')).toBeVisible();
    await expect(page.getByText('2400000.00 USDC')).toBeVisible();
    await expect(page.getByText('inv_smoke_market_1')).toBeVisible();

    // Newest first by default: the 2026-08-11 listing leads.
    await expect(cards.first()).toContainText('2400000.00 USDC');

    // Sort by asking price, cheapest first.
    await page.getByLabel('Sort listings').selectOption('price_asc');
    await expect(cards.first()).toContainText('9500.00 XLM');

    // Find one position by its invoice reference.
    await page.getByLabel('Search listings').fill('inv_smoke_market_2');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('2400000.00 USDC');

    // Filter by the currency the seller wants to be paid in.
    await page.getByLabel('Search listings').fill('');
    await page.getByLabel('Filter by asking currency').selectOption('XLM');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('9500.00 XLM');
  });

  test('list: a lender publishes an ask for a position they hold', async ({ page }) => {
    await authenticate(page, { offers: [SMOKE_POSITION_OFFER] });
    await mockUserProfile(page, ORIGINATOR);
    const store = await mockPositionListings(page, []);

    await page.goto('/marketplace/positions');

    await page.getByRole('button', { name: 'List a position' }).click();

    // Selecting the position prefills its full size (1 token = 1 base unit of principal).
    await page.getByLabel('Position', { exact: true }).selectOption(SMOKE_POSITION_OFFER.id);
    await expect(page.getByLabel('Position tokens')).toHaveValue('1000');

    await page.getByLabel('Asking price').fill('950.00');
    await page.getByRole('button', { name: 'Publish listing' }).click();

    // The listing really hit the table, with the invoice reference and price.
    await expect.poll(() => store.inserted.length).toBe(1);
    expect(store.inserted[0]).toMatchObject({
      seller: ORIGINATOR,
      seller_id: SMOKE_USER.id,
      invoice_id: SMOKE_POSITION_OFFER.invoice_id,
      offer_id: SMOKE_POSITION_OFFER.id,
      token_amount: '1000',
      asking_price: '950.00',
      price_currency: 'USDC',
      status: 'Open',
    });

    // …and it is discoverable straight away, under the seller's own listings.
    await expect(page.getByRole('heading', { name: 'Your listings' })).toBeVisible();
    const mine = page.getByTestId('position-listing');
    await expect(mine).toHaveCount(1);
    await expect(mine.first()).toContainText('950.00 USDC');
    await expect(mine.first()).toContainText('1000 position tokens');
  });

  test('guard: a listing larger than the position is rejected', async ({ page }) => {
    await authenticate(page, { offers: [SMOKE_POSITION_OFFER] });
    await mockUserProfile(page, ORIGINATOR);
    const store = await mockPositionListings(page, []);

    await page.goto('/marketplace/positions');

    await page.getByRole('button', { name: 'List a position' }).click();
    await page.getByLabel('Position', { exact: true }).selectOption(SMOKE_POSITION_OFFER.id);
    await page.getByLabel('Position tokens').fill('5000');
    await page.getByLabel('Asking price').fill('950.00');
    await page.getByRole('button', { name: 'Publish listing' }).click();

    await expect(page.getByText('That position is only worth 1000 position tokens.')).toBeVisible();
    expect(store.inserted).toHaveLength(0);
  });

  test('settle: a seller closes their own listing', async ({ page }) => {
    const own = {
      ...SMOKE_LISTINGS[0],
      id: 'lst_smoke_own',
      seller_id: SMOKE_USER.id,
      seller: ORIGINATOR,
    };
    await authenticate(page);
    await mockUserProfile(page, ORIGINATOR);
    const store = await mockPositionListings(page, [own]);

    await page.goto('/marketplace/positions');

    const card = page.getByTestId('position-listing').first();
    await expect(card).toContainText('Open');

    // Settlement itself is a bilateral SEP-41 transfer — the listing only
    // hands off to the portfolio transfer form with the size prefilled.
    await expect(card.getByRole('link', { name: /Settle: transfer/ })).toHaveAttribute(
      'href',
      `/portfolio?amount=${encodeURIComponent(own.token_amount)}#transfer`,
    );

    await card.getByRole('button', { name: 'Withdraw' }).click();

    await expect.poll(() => store.updated.length).toBe(1);
    expect(store.updated[0].id).toBe('lst_smoke_own');
    expect(store.updated[0].body).toMatchObject({ status: 'Withdrawn' });
    await expect(card).toContainText('Withdrawn');
  });
});
