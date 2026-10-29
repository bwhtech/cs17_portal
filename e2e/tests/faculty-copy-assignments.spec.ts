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
let nextCohort: CS17Cohort;

test.describe("Copy assignments", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		nextCohort = await createTestCohort(request);
	});

	test.afterAll(async ({ request }) => {
		for (const { name } of [cohort, nextCohort]) {
			await cleanupTestAssignments(request, name);
			await deleteDoc(request, "CS17 Cohort", name);
		}
	});

	test("copies a published assignment to another cohort as a draft", async ({
		page,
		request,
	}) => {
		const assignment = await createTestAssignment(request, { cohort: cohort.name });

		await page.goto("/dashboard/faculty/assignments");
		await page.locator(LIST_ROW, { hasText: assignment.title }).getByRole("checkbox").click();
		await page
			.getByRole("region", { name: "Selected assignments" })
			.getByRole("button", { name: "Copy" })
			.click();
		const dialog = page.getByRole("dialog");
		await dialog.getByRole("combobox").filter({ hasText: "Select a cohort" }).click();
		await page.getByRole("listbox").waitFor();
		await page.keyboard.type(nextCohort.name);
		await page.keyboard.press("Enter");
		await dialog.getByRole("button", { name: "Copy", exact: true }).click();

		await expect(page.getByText(`Copied 1 assignment to ${nextCohort.name}.`)).toBeVisible();
		await expect(
			page
				.locator(LIST_ROW, { hasText: assignment.title })
				.filter({ hasText: nextCohort.name })
		).toContainText("Draft");
	});
});
