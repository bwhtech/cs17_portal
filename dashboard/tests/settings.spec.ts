import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mockFrappe.ts';

test.describe('SettingsPage', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/dashboard/settings');
  });

  test('shows student name and cohort', async ({ page }) => {
    const main = page.locator('main');
    await expect(main.getByText('Alex Johnson')).toBeVisible();
    await expect(main.getByText(/CS17-2024/)).toBeVisible();
  });

  test('renders dark mode toggle', async ({ page }) => {
    await expect(page.getByRole('switch')).toBeVisible();
  });

  test('renders log out button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
  });
});