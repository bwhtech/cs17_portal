import { test, expect } from "@playwright/test";
import {
	CS17Assignment,
	CS17Cohort,
	createTestAssignment,
	createTestCohort,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { deleteDoc } from "../helpers/frappe";

test.describe("Faculty assignment page title", () => {
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

	test("drops the last assignment's name on one that does not exist", async ({ page }) => {
		await page.goto("/dashboard/faculty/assignments/E2E-MISSING");
		await page.getByRole("link", { name: "Assignments", exact: true }).click();
		await page.getByRole("link", { name: assignment.title, exact: true }).click();
		await expect(page).toHaveTitle(`${assignment.title} | CS17 Portal`);

		await page.evaluate(() => history.go(-2));

		await expect(page.getByText("Assignment not found")).toBeVisible();
		await expect(page).toHaveTitle("Assignment | CS17 Portal");
	});
});
