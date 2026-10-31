import { test, expect } from "@playwright/test";

const SUBMISSION = {
	name: "E2E-SUBMISSION",
	student: "E2E-STUDENT",
	full_name: "E2E Student",
	assignment: "E2E-ASSIGNMENT",
	assignment_title: "E2E Python task",
	submitted_at: "2026-01-01 00:00:00",
	submission_type: "Python",
	max_marks: 20,
	evaluation_type: "Marks",
	marks_obtained: null,
	grade: null,
	graded: false,
	can_check_with_ai: true,
};

const DRAFT = { marks_obtained: 15, grade: null, remarks: "Reads the input and prints it." };

const ASSIGNMENT_SUBMISSIONS = {
	assignment: {
		name: SUBMISSION.assignment,
		title: SUBMISSION.assignment_title,
		due_date: "2026-01-08 09:00:00",
		submission_type: "Python",
		assignment_type: "Graded",
		remarks: "Marks",
		max_marks: 20,
		can_check_with_ai: true,
	},
	submissions: [SUBMISSION],
	not_submitted: [],
};

test.describe("Faculty AI check", () => {
	test("fills the grade form from the AI check without saving it", async ({ page }) => {
		await page.route(/cs17_portal\.api\.get_submission\?/, (route) =>
			route.fulfill({ json: { data: SUBMISSION } })
		);
		await page.route("**/cs17_portal.api.get_submission_code*", (route) =>
			route.fulfill({ json: { data: "print(input())" } })
		);
		await page.route(/cs17_portal\.api\.get_assignment\?/, (route) =>
			route.fulfill({
				json: {
					data: {
						name: SUBMISSION.assignment,
						title: SUBMISSION.assignment_title,
						test_cases: [],
					},
				},
			})
		);
		await page.route("**/cs17_portal.api.get_submission_grade*", (route) =>
			route.fulfill({ json: { data: null } })
		);
		await page.route("**/cs17_portal.api.check_submission", (route) =>
			route.fulfill({ json: { data: DRAFT } })
		);
		const savedGrades: string[] = [];
		await page.route("**/cs17_portal.api.save_grade", (route) => {
			savedGrades.push(route.request().postData() ?? "");
			return route.abort();
		});

		await page.goto(`/dashboard/faculty/submissions/${SUBMISSION.name}`);
		await page.getByRole("button", { name: "Check with AI" }).click();

		await expect(page.getByLabel("Marks obtained")).toHaveValue("15");
		await expect(page.getByLabel("Remarks", { exact: true })).toHaveValue(DRAFT.remarks);
		expect(savedGrades).toEqual([]);
	});

	test("fills the assignment page's grade dialog from the AI check", async ({ page }) => {
		await page.route("**/cs17_portal.api.get_assignment_submissions*", (route) =>
			route.fulfill({ json: { data: ASSIGNMENT_SUBMISSIONS } })
		);
		await page.route("**/cs17_portal.api.check_submission", (route) =>
			route.fulfill({ json: { data: DRAFT } })
		);

		await page.goto(`/dashboard/faculty/assignments/${SUBMISSION.assignment}`);
		await page.getByRole("button", { name: "Grade", exact: true }).click();
		await page.getByRole("button", { name: "Check with AI" }).click();

		await expect(page.getByLabel("Marks (out of 20)")).toHaveValue("15");
		await expect(page.getByLabel("Remarks", { exact: true })).toHaveValue(DRAFT.remarks);
	});

	test("checks the selected submissions with AI from the bulk bar", async ({ page }) => {
		await page.route("**/cs17_portal.api.get_assignment_submissions*", (route) =>
			route.fulfill({ json: { data: ASSIGNMENT_SUBMISSIONS } })
		);
		const checks: unknown[] = [];
		await page.route("**/cs17_portal.api.check_submissions", (route) => {
			checks.push(route.request().postDataJSON());
			return route.fulfill({ json: { data: { queued: 1, skipped: 0 } } });
		});

		await page.goto(`/dashboard/faculty/assignments/${SUBMISSION.assignment}`);
		await page
			.locator('[data-slot="list-row"]', { hasText: SUBMISSION.full_name })
			.getByRole("checkbox")
			.check();
		await page
			.getByRole("region", { name: "Selected submissions" })
			.getByRole("button", { name: "Check with AI" })
			.click();
		await page.getByRole("button", { name: "Confirm" }).click();

		await expect(page.getByText("Checking 1 submission with AI.")).toBeVisible();
		expect(checks).toEqual([{ submissions: [SUBMISSION.name] }]);
	});

	test("saves the model from the Settings dialog", async ({ page }) => {
		await page.route("**/cs17_portal.api.get_ai_settings", (route) =>
			route.fulfill({ json: { data: { model: null, has_api_key: false } } })
		);
		const saves: unknown[] = [];
		await page.route("**/cs17_portal.api.save_ai_settings", (route) => {
			saves.push(route.request().postDataJSON());
			return route.fulfill({
				json: { data: { model: "openai/gpt-5", has_api_key: false } },
			});
		});

		await page.goto("/dashboard");
		await page.locator('[data-slot="sidebar"] button').last().click();
		await page.getByRole("menuitem", { name: "Settings" }).click();
		await page.getByRole("tab", { name: "AI check" }).click();
		await page.getByLabel("Model", { exact: true }).fill("openai/gpt-5");
		await page.getByLabel("Model", { exact: true }).blur();

		await expect(page.getByText("Model saved")).toBeVisible();
		expect(saves).toEqual([{ model: "openai/gpt-5" }]);
	});
});
