import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mockFrappe.ts';

test.describe('AssignmentsPage', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
    await page.goto('/dashboard/assignments');
  });

  test('shows heading and total count', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Assignments' }),
    ).toBeVisible();
    await expect(page.getByText('3 total')).toBeVisible();
  });

  test('renders all three assignment rows', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'Problem Set 1' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Problem Set 2' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Lab Report' }),
    ).toBeVisible();
  });

  test('ASGN-001 shows Pending badge and Submit button', async ({ page }) => {
    const row = page.getByRole('row', { name: /Problem Set 1/ });
    await expect(row.getByText('Pending')).toBeVisible();
    await expect(row.getByRole('button', { name: 'Submit' })).toBeVisible();
  });

  test('ASGN-002 shows Submitted badge and View Grade button', async ({ page }) => {
    const row = page.getByRole('row', { name: /Problem Set 2/ });
    await expect(row.getByText('Submitted')).toBeVisible();
    await expect(row.getByRole('button', { name: 'View Grade' })).toBeVisible();
    await expect(row.getByRole('button', { name: 'Edit' })).not.toBeVisible();
  });

  test('ASGN-003 shows Pending badge and Submit button', async ({ page }) => {
    const row = page.getByRole('row', { name: /Lab Report/ });
    await expect(row.getByText('Pending')).toBeVisible();
    await expect(row.getByRole('button', { name: 'Submit' })).toBeVisible();
  });
});
