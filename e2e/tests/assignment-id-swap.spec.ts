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

	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		assignment = await createTestAssignment(request, { cohort: cohort.name });
	});

	test.afterAll(async ({ request }) => {
		await deleteDoc(request, "CS17 Assignment", assignment.name);
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
});
