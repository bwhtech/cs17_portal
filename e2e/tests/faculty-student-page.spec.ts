import { test, expect } from "@playwright/test";
import {
	CS17Assignment,
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
import { deleteDoc } from "../helpers/frappe";

const LIST_ROW = '[data-slot="list-row"]';

let cohort: CS17Cohort;
let student: CS17Profile;
let assignment: CS17Assignment;
let submission: CS17Submission;

test.describe("Student page", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		student = await createTestProfile(request, { cohort: cohort.name });
		assignment = await createTestAssignment(request, {
			cohort: cohort.name,
			assignmentType: "Graded",
		});
		submission = await createTestSubmission(request, {
			assignment: assignment.name,
			student: student.name,
		});
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestSubmissions(request, cohort.name);
		await cleanupTestAssignments(request, cohort.name);
		await deleteTestProfile(request, student.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("the student's name on the assignment page opens their page", async ({ page }) => {
		await page.goto(`/dashboard/faculty/assignments/${assignment.name}`);
		await page.getByRole("link", { name: student.full_name!, exact: true }).click();

		await expect(page).toHaveURL(new RegExp(`/faculty/students/${student.name}$`));
		await expect(page.locator(LIST_ROW, { hasText: assignment.title })).toContainText(
			"Submitted"
		);
	});

	test("the student's name on Submissions opens their page", async ({ page }) => {
		await page.goto("/dashboard/faculty/submissions");
		await page.getByRole("link", { name: student.full_name!, exact: true }).click();

		await expect(page).toHaveURL(new RegExp(`/faculty/students/${student.name}$`));
	});

	test("a submitted assignment opens its grading page", async ({ page }) => {
		await page.goto(`/dashboard/faculty/students/${student.name}`);
		await page.getByRole("link", { name: assignment.title, exact: true }).click();

		await expect(page).toHaveURL(new RegExp(`/faculty/submissions/${submission.name}$`));
	});
});
