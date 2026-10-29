import { test, expect } from "@playwright/test";
import {
	CS17Cohort,
	CS17Profile,
	cleanupTestAssignments,
	cleanupTestSubmissions,
	createTestAssignment,
	createTestCohort,
	createTestProfile,
	createTestSubmission,
	deleteTestProfile,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { deleteDoc } from "../helpers/frappe";

const LIST_ROW = '[data-slot="list-row"]';

let sessionProfile: string | null;
let cohort: CS17Cohort;
let student: CS17Profile;

test.describe("Submissions paging", () => {
	test.beforeAll(async ({ request }) => {
		sessionProfile = await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		student = await createTestProfile(request, { cohort: cohort.name });
		for (let n = 0; n < 21; n++) {
			const assignment = await createTestAssignment(request, { cohort: cohort.name });
			await createTestSubmission(request, {
				assignment: assignment.name,
				student: student.name,
			});
		}
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestSubmissions(request, cohort.name);
		await cleanupTestAssignments(request, cohort.name);
		await deleteTestProfile(request, student.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
		if (sessionProfile) await deleteTestProfile(request, sessionProfile);
	});

	test("shows twenty submissions, then the rest on Load more", async ({ page }) => {
		await page.goto("/dashboard/faculty/submissions");
		await expect(page.locator(LIST_ROW)).toHaveCount(20);

		await page.getByRole("button", { name: "Load more" }).click();

		await expect(page.locator(LIST_ROW, { hasText: student.full_name! })).toHaveCount(21);
		await expect(page.getByRole("button", { name: "Load more" })).toHaveCount(0);
	});
});
