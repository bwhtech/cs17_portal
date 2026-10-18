import { test, expect } from "@playwright/test";
import { TEST_ASSIGNMENT_PREFIX, ensureSessionFaculty } from "../helpers/cs17";

const ASSIGNMENT = {
	name: "E2E-ASSIGNMENT",
	title: TEST_ASSIGNMENT_PREFIX,
	due_date: "2026-01-08 09:00:00",
	assignment_type: "Graded",
	remarks: "Grade",
};

const SUBMISSION = {
	name: "E2E-SUBMISSION",
	student: "E2E-STUDENT",
	full_name: "E2E Student",
	submitted_at: "2026-01-01 00:00:00",
};

const REFUSED = { errors: [{ type: "PermissionError", message: "Not permitted" }] };

test.describe("Faculty grade states", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
	});

	test("shows a grade whose scheduled time has passed as published", async ({ page }) => {
		await page.route("**/cs17_portal.api.get_assignment_submissions*", (route) =>
			route.fulfill({
				json: {
					data: {
						assignment: ASSIGNMENT,
						submissions: [
							{
								...SUBMISSION,
								grade: {
									grade: "B",
									marks_obtained: null,
									is_published: 0,
									published_on: "2000-01-01 09:00:00",
								},
							},
						],
						not_submitted: [],
					},
				},
			})
		);

		await page.goto(`/dashboard/faculty/assignments/${ASSIGNMENT.name}`);

		await expect(page.getByText("Published", { exact: true })).toBeVisible();
		await page
			.locator('[data-slot="list-row"]', { hasText: SUBMISSION.full_name })
			.getByRole("checkbox")
			.check();
		await expect(page.getByRole("button", { name: "Publish 1 grade" })).toHaveCount(0);
	});

	test.describe("the grading page", () => {
		test.beforeEach(async ({ page }) => {
			await page.route(/cs17_portal\.api\.get_submission\?/, (route) =>
				route.fulfill({
					json: {
						data: {
							...SUBMISSION,
							assignment: ASSIGNMENT.name,
							assignment_title: ASSIGNMENT.title,
							submission_type: "PDF",
							max_marks: 0,
							evaluation_type: "Grade",
							marks_obtained: null,
							grade: null,
							graded: false,
						},
					},
				})
			);
		});

		test("says why the submitted file is refused, with no retry", async ({ page }) => {
			await page.route("**/cs17_portal.api.get_submission_grade*", (route) =>
				route.fulfill({ json: { data: null } })
			);
			await page.route(/cs17_portal\.api\.get_submission\?/, (route) =>
				route.fulfill({ status: 403, json: REFUSED })
			);
			await page.goto(`/dashboard/faculty/submissions/${SUBMISSION.name}`);

			await expect(
				page.getByText("This submission is not available in your cohort.")
			).toBeVisible();
			await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
		});

		test("says why the grade is refused, with no retry", async ({ page }) => {
			await page.route("**/cs17_portal.api.get_assignment_submissions*", (route) =>
				route.fulfill({
					json: { data: { assignment: ASSIGNMENT, submissions: [], not_submitted: [] } },
				})
			);
			await page.route("**/cs17_portal.api.get_submission_grade*", (route) =>
				route.fulfill({ status: 403, json: REFUSED })
			);
			await page.goto(`/dashboard/faculty/submissions/${SUBMISSION.name}`);

			await expect(page.getByText("Not permitted")).toBeVisible();
			await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
		});
	});
});
