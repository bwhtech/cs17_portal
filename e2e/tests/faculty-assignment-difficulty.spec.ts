import { test, expect } from "@playwright/test";
import {
	CS17Cohort,
	cleanupTestAssignments,
	createTestAssignment,
	createTestCohort,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { deleteDoc } from "../helpers/frappe";

const LIST_ROW = '[data-slot="list-row"]';

let cohort: CS17Cohort;

test.describe("Assignment difficulty", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestAssignments(request, cohort.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("marks an assignment as easy from the bulk bar", async ({ page, request }) => {
		const assignment = await createTestAssignment(request, { cohort: cohort.name });
		const row = page.locator(LIST_ROW, { hasText: assignment.title });

		await page.goto("/dashboard/faculty/assignments");
		await row.getByRole("checkbox").click();
		await page.getByRole("button", { name: "Set difficulty" }).click();
		await page.getByRole("menuitem", { name: "Easy" }).click();

		await expect(row.getByText("Easy", { exact: true })).toBeVisible();
	});
});
