import { test, expect } from "@playwright/test";
import {
	CS17Assignment,
	CS17Cohort,
	createTestAssignment,
	createTestCohort,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { deleteDoc } from "../helpers/frappe";

test.describe("Assignment page id swap", () => {
	let cohort: CS17Cohort;
	let assignment: CS17Assignment;
	let other: CS17Assignment;

	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		assignment = await createTestAssignment(request, { cohort: cohort.name });
		other = await createTestAssignment(request, { cohort: cohort.name });
	});

	test.afterAll(async ({ request }) => {
		await deleteDoc(request, "CS17 Assignment", assignment.name);
		await deleteDoc(request, "CS17 Assignment", other.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("does not keep the last assignment when the next one cannot be reached", async ({
		page,
	}) => {
		await page.route(
			"**/cs17_portal.api.get_assignment_submissions?assignment=E2E-OFFLINE",
			(route) => route.abort()
		);
		await page.goto("/dashboard/faculty/assignments/E2E-OFFLINE");
		await page.getByRole("link", { name: "Assignments", exact: true }).click();
		await page.getByRole("link", { name: assignment.title, exact: true }).click();
		await expect(page).toHaveTitle(`${assignment.title} | CS17 Portal`);

		await page.evaluate(() => history.go(-2));

		await expect(page.getByText("Could not load this assignment")).toBeVisible();
	});

	test("clears the selected rows when the page moves to another assignment", async ({
		page,
	}) => {
		await page.route(
			`**/cs17_portal.api.get_assignment_submissions?assignment=${assignment.name}`,
			(route) =>
				route.fulfill({
					json: {
						data: {
							assignment,
							submissions: [
								{
									name: "E2E-SUBMISSION",
									student: "E2E-STUDENT",
									full_name: "E2E Student",
									submitted_at: "2026-01-01 00:00:00",
								},
							],
							not_submitted: [],
						},
					},
				})
		);
		await page.goto(`/dashboard/faculty/assignments/${other.name}`);
		await page.getByRole("link", { name: "Assignments", exact: true }).first().click();
		await page.getByRole("link", { name: assignment.title, exact: true }).click();
		await page
			.locator('[data-slot="list-row"]', { hasText: "E2E Student" })
			.getByRole("checkbox")
			.check();
		await expect(page.getByRole("region", { name: "Selected submissions" })).toBeVisible();

		await page.evaluate(() => history.go(-2));

		await expect(page).toHaveTitle(`${other.title} | CS17 Portal`);
		await expect(page.getByRole("region", { name: "Selected submissions" })).toBeHidden();
	});
});
