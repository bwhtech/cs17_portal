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
			route.fulfill({
				json: {
					data: {
						marks_obtained: 15,
						grade: null,
						remarks: "Reads the input and prints it.",
					},
				},
			})
		);
		const savedGrades: string[] = [];
		await page.route("**/cs17_portal.api.save_grade", (route) => {
			savedGrades.push(route.request().postData() ?? "");
			return route.abort();
		});

		await page.goto(`/dashboard/faculty/submissions/${SUBMISSION.name}`);
		await page.getByRole("button", { name: "Check with AI" }).click();

		await expect(page.getByLabel("Marks obtained")).toHaveValue("15");
		await expect(page.getByLabel("Remarks")).toHaveValue("Reads the input and prints it.");
		expect(savedGrades).toEqual([]);
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
