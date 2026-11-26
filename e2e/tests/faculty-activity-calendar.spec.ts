import { expect, test } from "@playwright/test";
import {
	CS17Cohort,
	CS17Profile,
	cleanupTestAssignments,
	createTestAssignment,
	createTestCohort,
	createTestProfile,
	deleteTestProfile,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { callGetMethod, createDoc, deleteDoc } from "../helpers/frappe";

let cohort: CS17Cohort;
let student: CS17Profile;
let run: string;

test.describe("Activity calendar", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		student = await createTestProfile(request, { cohort: cohort.name });
		const assignment = await createTestAssignment(request, {
			cohort: cohort.name,
			submissionType: "Python",
		});
		const { end } = await callGetMethod<{ end: string }>(
			request,
			"cs17_portal.activity_calendar.get_student_activity_calendar",
			{ student: student.name }
		);
		run = (
			await createDoc<{ name: string }>(request, "CS17 Code Run", {
				assignment: assignment.name,
				student: student.name,
				ran_at: `${end} 00:00:01`,
			})
		).name;
	});

	test.afterAll(async ({ request }) => {
		await deleteDoc(request, "CS17 Code Run", run);
		await cleanupTestAssignments(request, cohort.name);
		await deleteTestProfile(request, student.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("the student page shows the days the student worked", async ({ page }) => {
		await page.goto(`/dashboard/faculty/students/${student.name}`);

		const section = page.locator("section", {
			has: page.getByRole("heading", { name: "Activity" }),
		});
		await expect(section).toContainText("Active 1 of the last 7 days · 1 of the last 30");
	});
});
