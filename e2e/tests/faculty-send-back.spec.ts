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
import { deleteDoc, getDoc } from "../helpers/frappe";

const LIST_ROW = '[data-slot="list-row"]';

let cohort: CS17Cohort;
let student: CS17Profile;

test.describe("Send back for revision", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		student = await createTestProfile(request, {
			profileType: "Student",
			cohort: cohort.name,
		});
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestSubmissions(request, cohort.name);
		await cleanupTestAssignments(request, cohort.name);
		await deleteTestProfile(request, student.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("sends a submission back with a reason", async ({ page, request }) => {
		const assignment = await createTestAssignment(request, { cohort: cohort.name });
		const submission = await createTestSubmission(request, {
			assignment: assignment.name,
			student: student.name,
		});
		const row = page.locator(LIST_ROW, { hasText: student.full_name });

		await page.goto(`/dashboard/faculty/assignments/${assignment.name}`);
		await row.getByRole("button", { name: "Send back" }).click();
		await page
			.getByLabel(/What should they change/)
			.fill("Add the second page of the report.");
		await page.getByRole("dialog").getByRole("button", { name: "Send back" }).click();

		await expect(row.getByText("Returned")).toBeVisible();
		await expect
			.poll(
				async () =>
					(
						await getDoc<{ returned_on: string | null }>(
							request,
							"CS17 Assignment Submission",
							submission.name
						)
					).returned_on
			)
			.toBeTruthy();
	});
});
