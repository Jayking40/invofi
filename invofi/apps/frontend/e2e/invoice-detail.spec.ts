import { test, expect } from '@playwright/test';
import { authenticate, SMOKE_INVOICE } from './fixtures';

test.describe('invoice detail', () => {
  test('renders the on-chain invoice fields and print CTA', async ({ page }) => {
    await authenticate(page, { invoice: SMOKE_INVOICE });

    await page.goto(`/invoices/${SMOKE_INVOICE.id}`);

    await expect(page.getByText(SMOKE_INVOICE.id)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Invoice' })).toBeVisible();

    // Field values: amount is i128 stroops formatted to "2 XLM". The
    // originator is rendered truncated (e.g. "GCHV…OVMT").
    await expect(page.getByText('2 XLM')).toBeVisible();
    await expect(page.getByText('XLM', { exact: true }).first()).toBeVisible();
    const truncated = `${SMOKE_INVOICE.originator.slice(0, 4)}…${SMOKE_INVOICE.originator.slice(-4)}`;
    await expect(page.getByText(truncated)).toBeVisible();

    await expect(
      page.getByRole('button', { name: /Print \/ Export PDF/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Financing Offers/ }),
    ).toBeVisible();
  });
});
