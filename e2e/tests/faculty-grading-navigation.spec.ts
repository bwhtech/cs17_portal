import { test, expect } from "@playwright/test";
import {
	CS17Cohort,
	CS17Profile,
	CS17Submission,
	cleanupTestAssignments,
	cleanupTestSubmissions,
	createTestAssignment,
	createTestCohort,
	createTestProfile,
	createTestSubmission,
	deleteTestProfile,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { deleteDoc, updateDoc } from "../helpers/frappe";

const LIST_ROW = '[data-slot="list-row"]';

let cohort: CS17Cohort;
let firstStudent: CS17Profile;
let secondStudent: CS17Profile;
let later: CS17Submission;
let earlier: CS17Submission;

test.describe("Grading page navigation", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		firstStudent = await createTestProfile(request, { cohort: cohort.name });
		secondStudent = await createTestProfile(request, { cohort: cohort.name });
		const assignment = await createTestAssignment(request, {
			cohort: cohort.name,
			assignmentType: "Graded",
		});
		later = await createTestSubmission(request, {
			assignment: assignment.name,
			student: firstStudent.name,
		});
		await updateDoc(request, "CS17 Assignment Submission", later.name, {
			submitted_at: "2026-01-02 00:00:00",
		});
		earlier = await createTestSubmission(request, {
			assignment: assignment.name,
			student: secondStudent.name,
		});
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestSubmissions(request, cohort.name);
		await cleanupTestAssignments(request, cohort.name);
		await deleteTestProfile(request, firstStudent.name);
		await deleteTestProfile(request, secondStudent.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("moves through the assignment's submissions, latest first", async ({ page }) => {
		await page.goto(`/dashboard/faculty/submissions/${later.name}`);
		await expect(page.getByRole("button", { name: "Previous submission" })).toBeDisabled();
		await page.getByRole("link", { name: "Next submission" }).click();

		await expect(page).toHaveURL(new RegExp(`/faculty/submissions/${earlier.name}$`));
		await expect(page.getByRole("button", { name: "Next submission" })).toBeDisabled();
	});

	test("keeps an unsaved remark after moving away and back", async ({ page }) => {
		await page.goto(`/dashboard/faculty/submissions/${later.name}`);
		await page
			.getByLabel("Remarks", { exact: true })
			.fill("Label the axes on the second chart.");
		await page.getByRole("link", { name: "Next submission" }).click();
		await expect(page).toHaveURL(new RegExp(`/faculty/submissions/${earlier.name}$`));
		await page.getByRole("link", { name: "Previous submission" }).click();

		await expect(page.getByLabel("Remarks", { exact: true })).toHaveValue(
			"Label the axes on the second chart."
		);
	});

	test("goes back to Submissions in one step after moving", async ({ page }) => {
		await page.goto("/dashboard/faculty/submissions");
		await page.locator(LIST_ROW, { hasText: firstStudent.full_name! }).click();
		await page.getByRole("link", { name: "Next submission" }).click();
		await expect(page).toHaveURL(new RegExp(`/faculty/submissions/${earlier.name}$`));
		await page.getByRole("button", { name: "Back", exact: true }).click();

		await expect(page).toHaveURL(/\/dashboard\/faculty\/submissions$/);
	});
});
