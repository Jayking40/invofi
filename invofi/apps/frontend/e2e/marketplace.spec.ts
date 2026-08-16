import { test, expect } from '@playwright/test';
import { authenticate, SMOKE_INVOICES } from './fixtures';

test.describe('marketplace', () => {
  test('loads invoices for an authenticated lender', async ({ page }) => {
    await authenticate(page, { invoices: SMOKE_INVOICES });

    await page.goto('/marketplace');

    await expect(
      page.getByRole('heading', { name: 'Invoice Marketplace' }),
    ).toBeVisible();

    // Each mirrored invoice renders a card with its amount and a Make Offer CTA.
    await expect(page.getByText(SMOKE_INVOICES[0].id)).toBeVisible();
    await expect(page.getByText('10000 XLM')).toBeVisible();
    await expect(page.getByText('2500000 USDC')).toBeVisible();
    await expect(page.getByRole('link', { name: /Make Offer/ })).toHaveCount(
      SMOKE_INVOICES.length,
    );
  });
});
