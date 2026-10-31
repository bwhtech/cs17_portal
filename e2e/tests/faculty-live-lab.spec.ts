import { APIRequestContext, expect, test } from "@playwright/test";
import {
	CS17Assignment,
	CS17Cohort,
	CS17Profile,
	cleanupTestAssignments,
	createTestAssignment,
	createTestCohort,
	createTestProfile,
	deleteTestProfile,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { createDoc, deleteDoc } from "../helpers/frappe";

let cohort: CS17Cohort;
let firstStudent: CS17Profile;
let secondStudent: CS17Profile;
let assignment: CS17Assignment;
const runs: string[] = [];

async function addRun(
	request: APIRequestContext,
	student: CS17Profile,
	ranAt: string,
	result: Record<string, unknown>
) {
	const run = await createDoc<{ name: string }>(request, "CS17 Code Run", {
		assignment: assignment.name,
		student: student.name,
		ran_at: ranAt,
		...result,
	});
	runs.push(run.name);
}

test.describe("Live lab", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		firstStudent = await createTestProfile(request, { cohort: cohort.name });
		secondStudent = await createTestProfile(request, { cohort: cohort.name });
		assignment = await createTestAssignment(request, {
			cohort: cohort.name,
			submissionType: "Python",
		});
		await addRun(request, firstStudent, "2026-01-01 10:00:00", { passed: 1, total: 2 });
		await addRun(request, firstStudent, "2026-01-01 10:01:00", {
			error_type: "NameError",
			error_line: 4,
		});
		await addRun(request, secondStudent, "2026-01-01 10:00:00", {
			error_type: "NameError",
			error_line: 4,
		});
	});

	test.afterAll(async ({ request }) => {
		for (const run of runs) await deleteDoc(request, "CS17 Code Run", run);
		await cleanupTestAssignments(request, cohort.name);
		await deleteTestProfile(request, firstStudent.name);
		await deleteTestProfile(request, secondStudent.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("opens from the assignment page with each student's latest test result", async ({
		page,
	}) => {
		await page.goto(`/dashboard/faculty/assignments/${assignment.name}`);
		await page.getByRole("link", { name: "Live", exact: true }).click();
		const card = page.getByRole("listitem").filter({ hasText: firstStudent.full_name! });

		await expect(card.getByText("1 of 2 tests passed")).toBeVisible();
	});

	test("groups an error that several students share", async ({ page }) => {
		await page.goto(`/dashboard/faculty/assignments/${assignment.name}/live`);

		await expect(page.getByText("NameError on line 4: 2 students")).toBeVisible();
	});
});
