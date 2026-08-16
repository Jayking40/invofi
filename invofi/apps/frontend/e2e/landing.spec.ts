import { test, expect } from '@playwright/test';

test.describe('landing page', () => {
  test('renders the hero and links to register / marketplace', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: /Invoice Financing/ }),
    ).toBeVisible();
    await expect(page.getByText('On-Chain.', { exact: true })).toBeVisible();

    await expect(
      page.getByRole('link', { name: /Get Started/ }),
    ).toHaveAttribute('href', '/auth/register');
    await expect(
      page.getByRole('link', { name: /Browse Marketplace/ }).first(),
    ).toHaveAttribute('href', '/marketplace');
  });
});
