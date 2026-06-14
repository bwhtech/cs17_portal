import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mockFrappe.ts';

test('dashboard loads with mocked data', async ({ page }) => {
  await setupMocks(page);
  await page.goto('/dashboard');

  await expect(page.getByText('Welcome back, Alex.')).toBeVisible();
});
