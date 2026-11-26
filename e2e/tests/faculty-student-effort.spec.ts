import { expect, test } from "@playwright/test";
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

const LIST_ROW = '[data-slot="list-row"]';

let cohort: CS17Cohort;
let student: CS17Profile;
let assignment: CS17Assignment;
const records: [string, string][] = [];

test.describe("Student effort", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		student = await createTestProfile(request, { cohort: cohort.name });
		assignment = await createTestAssignment(request, {
			cohort: cohort.name,
			submissionType: "Python",
		});
		const work = { assignment: assignment.name, student: student.name };
		for (const [doctype, fields] of [
			["CS17 Code Run", { ran_at: "2030-01-01 10:00:00", passed: 1, total: 2 }],
			["CS17 Code Run", { ran_at: "2030-01-01 10:05:00", passed: 2, total: 2 }],
			["CS17 Hint", { asked_at: "2030-01-01 10:02:00" }],
		] as const) {
			const { name } = await createDoc<{ name: string }>(request, doctype, {
				...work,
				...fields,
			});
			records.push([doctype, name]);
		}
	});

	test.afterAll(async ({ request }) => {
		for (const [doctype, name] of records) await deleteDoc(request, doctype, name);
		await cleanupTestAssignments(request, cohort.name);
		await deleteTestProfile(request, student.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("shows runs to the first pass and hints next to the assignment", async ({ page }) => {
		await page.goto(`/dashboard/faculty/students/${student.name}`);

		await expect(page.locator(LIST_ROW, { hasText: assignment.title })).toContainText(
			"Passed on run 2 · 1 hint"
		);
	});
});
