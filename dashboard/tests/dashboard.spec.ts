import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mockFrappe.ts';

test.describe('DashboardPage', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/dashboard');
  });

  test('shows welcome heading with first name', async ({ page }) => {
    await expect(page.getByText('Welcome back, Alex.')).toBeVisible();
  });

  test('shows announcement banners', async ({ page }) => {
    await expect(page.getByText('Welcome to CS17')).toBeVisible();
    await expect(page.getByText('Assignment 1 Due Soon')).toBeVisible();
  });

  test('upcoming assignments shows only future assignments', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Problem Set 1' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lab Report' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Problem Set 2' })).toHaveCount(0);
  });

  test('"View all" link points to /assignments', async ({ page }) => {
    const link = page.getByRole('link', { name: /view all/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/dashboard/assignments');
  });
});