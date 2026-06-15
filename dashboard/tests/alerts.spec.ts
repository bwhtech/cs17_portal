import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mockFrappe.ts';

test.describe('AlertsPage', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/dashboard/announcements');
  });

  test('shows both announcement titles', async ({ page }) => {
    await expect(page.getByText('Welcome to CS17')).toBeVisible();
    await expect(page.getByText('Assignment 1 Due Soon')).toBeVisible();
  });

  test('shows dismiss button on each announcement', async ({ page }) => {
    const dismissButtons = page.locator('main button').filter({ has: page.locator('svg') });
    await expect(dismissButtons).toHaveCount(2);
  });

  test('dismissing an announcement replaces its button with "Dismissed"', async ({ page }) => {
    const dismissButtons = page.locator('main button').filter({ has: page.locator('svg') });
    await dismissButtons.first().click();
    await expect(page.getByText('Dismissed')).toBeVisible();
    await expect(dismissButtons).toHaveCount(1);
  });
});