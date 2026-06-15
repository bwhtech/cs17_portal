import { test, expect } from '@playwright/test';
import { setupMocks } from './helpers/mockFrappe.ts';

test.describe('AssignmentDetailPage', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page);
  });

  test.describe('ASGN-001 (future, no submission)', () => {
    test.beforeEach(async ({ page }) => {
      await page.route(/\/api\/resource\/CS17%20Assignment%20Submission/, (route) =>
        route.fulfill({ json: { data: [] } }),
      );
      await page.goto('/dashboard/assignments/ASGN-001/submission');
    });

    test('shows title and description', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Problem Set 1' })).toBeVisible();
      await expect(page.getByText('Complete problems 1 through 5.')).toBeVisible();
    });

    test('shows max marks', async ({ page }) => {
      await expect(page.locator('main').getByText('100')).toBeVisible();
    });

    test('shows enabled Submit Assignment button', async ({ page }) => {
      const btn = page.getByRole('button', { name: 'Submit Assignment' });
      await expect(btn).toBeVisible();
      await expect(btn).toBeEnabled();
    });
  });

  test.describe('ASGN-002 (overdue, submitted, graded)', () => {
    test.beforeEach(async ({ page }) => {
      await page.route(/\/api\/resource\/CS17%20Assignment\//, (route) =>
        route.fulfill({
          json: {
            data: {
              name: 'ASGN-002',
              title: 'Problem Set 2',
              due_date: '2020-01-01 23:59:59',
              max_marks: 50,
              assignment_type: 'Graded',
              description: '<p>Overdue assignment.</p>',
            },
          },
        }),
      );
      await page.goto('/dashboard/assignments/ASGN-002/submission');
    });

    test('shows Submitted label and date', async ({ page }) => {
      await expect(page.getByText('Submitted')).toBeVisible();
    });

    test('does not show Edit Submission (overdue + graded)', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Edit Submission' })).not.toBeVisible();
    });
  });
});