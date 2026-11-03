import { expect, test, type Page } from "@playwright/test";

const ASSIGNMENT = {
	name: "E2E-GREETING",
	title: "Greeting program",
	due_date: "2026-01-08 09:00:00",
	submission_type: "Python",
	assignment_type: "Graded",
	remarks: "Marks",
	max_marks: 10,
};

const SUBMISSIONS = [
	{
		name: "E2E-GREETING-AARAV",
		student: "E2E-AARAV",
		full_name: "Aarav Sharma",
		assignment: ASSIGNMENT.name,
		submitted_at: "2026-01-05 10:00:00",
	},
	{
		name: "E2E-GREETING-DIYA",
		student: "E2E-DIYA",
		full_name: "Diya Patel",
		assignment: ASSIGNMENT.name,
		submitted_at: "2026-01-04 10:00:00",
	},
];

const CODE: Record<string, string> = {
	"E2E-GREETING-AARAV": 'print("Hello, " + input())',
	"E2E-GREETING-DIYA": 'print("Hello, Asha")',
};

const TWO_TESTS = [
	{ input: "Asha\n", expected_output: "Hello, Asha", is_hidden: 0 },
	{ input: "Ravi\n", expected_output: "Hello, Ravi", is_hidden: 0 },
];

let testCases = TWO_TESTS;

function row(page: Page, student: string) {
	return page.locator('[data-slot="list-row"]', { hasText: student });
}

test.describe("Submission tests", () => {
	test.beforeEach(async ({ page }) => {
		testCases = TWO_TESTS;
		await page.route("**/cs17_portal.api.get_assignment_submissions*", (route) =>
			route.fulfill({
				json: {
					data: { assignment: ASSIGNMENT, submissions: SUBMISSIONS, not_submitted: [] },
				},
			})
		);
		await page.route(/cs17_portal\.api\.get_assignment\?/, (route) =>
			route.fulfill({ json: { data: { ...ASSIGNMENT, test_cases: testCases } } })
		);
		await page.route("**/cs17_portal.api.get_submission_code*", (route) =>
			route.fulfill({
				json: {
					data: CODE[new URL(route.request().url()).searchParams.get("submission")!],
				},
			})
		);
	});

	test("runs every submission against the tests", async ({ page }) => {
		await page.goto(`/dashboard/faculty/assignments/${ASSIGNMENT.name}`);
		await page.getByRole("button", { name: "More actions" }).click();
		await page.getByRole("menuitem", { name: "Run tests" }).click();

		await expect(row(page, "Aarav Sharma").getByTitle("2 of 2 tests passed")).toBeVisible({
			timeout: 60000,
		});
		await expect(row(page, "Diya Patel").getByTitle("1 of 2 tests passed")).toBeVisible();
	});

	test("shows the new results when run again after the tests change", async ({ page }) => {
		await page.goto(`/dashboard/faculty/assignments/${ASSIGNMENT.name}`);
		const moreActions = page.getByRole("button", { name: "More actions" });
		const runTests = page.getByRole("menuitem", { name: "Run tests" });
		await moreActions.click();
		await runTests.click();
		await expect(row(page, "Diya Patel").getByTitle("1 of 2 tests passed")).toBeVisible({
			timeout: 60000,
		});

		testCases = [
			...TWO_TESTS,
			{ input: "Meera\n", expected_output: "Hello, Meera", is_hidden: 0 },
		];
		await moreActions.click();
		await runTests.click();

		await expect(row(page, "Diya Patel").getByTitle("1 of 3 tests passed")).toBeVisible();
	});

	test("runs the tests from the phone menu and shows them on each card", async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(`/dashboard/faculty/assignments/${ASSIGNMENT.name}`);
		await page.getByRole("button", { name: "More actions" }).click();
		await page.getByRole("menuitem", { name: "Run tests" }).click();

		await expect(page.getByTitle("2 of 2 tests passed")).toBeVisible({ timeout: 60000 });
		await expect(page.getByTitle("1 of 2 tests passed")).toBeVisible();
		await expect(page.getByText("Tests", { exact: true })).toHaveCount(2);
	});
});
