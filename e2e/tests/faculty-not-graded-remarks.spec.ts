import { test, expect } from "@playwright/test";
import {
	CS17Cohort,
	CS17Profile,
	cleanupTestAssignments,
	cleanupTestGrades,
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
const REMARKS = "Good use of loops. Name your variables after what they hold.";

let cohort: CS17Cohort;
let student: CS17Profile;

test.describe("Remarks on Not Graded work", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		student = await createTestProfile(request, {
			profileType: "Student",
			cohort: cohort.name,
		});
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestGrades(request, cohort.name);
		await cleanupTestSubmissions(request, cohort.name);
		await cleanupTestAssignments(request, cohort.name);
		await deleteTestProfile(request, student.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("publishes remarks from the assignment page", async ({ page, request }) => {
		const assignment = await createTestAssignment(request, { cohort: cohort.name });
		await createTestSubmission(request, {
			assignment: assignment.name,
			student: student.name,
		});
		const row = page.locator(LIST_ROW, { hasText: student.full_name });

		await page.goto(`/dashboard/faculty/assignments/${assignment.name}`);
		await row.getByRole("button", { name: "Add remarks" }).click();
		await page.getByLabel("Remarks").fill(REMARKS);
		await page.getByRole("combobox").filter({ hasText: "Save as draft" }).click();
		await page.getByRole("option", { name: "Publish now" }).click();
		await page.getByRole("button", { name: "Save remarks" }).click();

		await expect(row.getByText("Published", { exact: true })).toBeVisible();
	});

	test("saves remarks from the grading page", async ({ page, request }) => {
		const assignment = await createTestAssignment(request, { cohort: cohort.name });
		const submission = await createTestSubmission(request, {
			assignment: assignment.name,
			student: student.name,
		});

		await page.goto(`/dashboard/faculty/submissions/${submission.name}`);
		await page.getByLabel("Remarks").fill(REMARKS);
		await page.getByRole("button", { name: "Save remarks" }).click();

		await expect(page.getByRole("button", { name: "Update remarks" })).toBeVisible();
	});
});
