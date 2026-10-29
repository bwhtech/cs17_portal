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

const REMARKS = "Print it as `Hello, <name>!`";

let cohort: CS17Cohort;
let student: CS17Profile;

test.describe("Grade remarks", () => {
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

	test("keeps tag shaped text in the remarks", async ({ page, request }) => {
		const assignment = await createTestAssignment(request, {
			cohort: cohort.name,
			assignmentType: "Graded",
		});
		const submission = await createTestSubmission(request, {
			assignment: assignment.name,
			student: student.name,
		});

		await page.goto(`/dashboard/faculty/submissions/${submission.name}`);
		await page.getByLabel("Remarks").fill(REMARKS);
		await page.getByRole("button", { name: "Save grade" }).click();
		await expect(page.getByRole("button", { name: "Update grade" })).toBeVisible();

		await page.reload();
		await expect(page.getByLabel("Remarks")).toHaveValue(REMARKS);
	});
});
