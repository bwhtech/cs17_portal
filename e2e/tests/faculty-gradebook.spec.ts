import { readFile } from "fs/promises";
import { test, expect } from "@playwright/test";
import {
	CS17Assignment,
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
import { callMethod, deleteDoc } from "../helpers/frappe";

let cohort: CS17Cohort;
let student: CS17Profile;
let assignment: CS17Assignment;

test.describe("Gradebook download", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		student = await createTestProfile(request, { cohort: cohort.name });
		assignment = await createTestAssignment(request, {
			cohort: cohort.name,
			assignmentType: "Graded",
		});
		const submission = await createTestSubmission(request, {
			assignment: assignment.name,
			student: student.name,
		});
		await callMethod(request, "cs17_portal.api.grade_submission", {
			submission: submission.name,
			grade: "A",
			publish: "now",
		});
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestGrades(request, cohort.name);
		await cleanupTestSubmissions(request, cohort.name);
		await cleanupTestAssignments(request, cohort.name);
		await deleteTestProfile(request, student.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("All marks downloads each assignment's published grade", async ({ page }) => {
		await page.goto("/dashboard/faculty/reports");
		await page.getByRole("combobox", { name: "Cohort" }).click();
		await page.getByRole("listbox").waitFor();
		await page.keyboard.type(cohort.name);
		await page.keyboard.press("Enter");
		await expect(page.locator('[data-slot="list-row"]')).toContainText(student.full_name!);
		await page.getByRole("button", { name: "Download", exact: true }).click();
		const download = page.waitForEvent("download");
		await page.getByRole("menuitem", { name: "All marks" }).click();

		const lines = (await readFile(await (await download).path(), "utf8")).split(/\r?\n/);
		expect(lines[0]).toBe(`"Student","${assignment.title}","Average","Grade"`);
		expect(lines[1]).toBe(`"${student.full_name}","A","",""`);
	});
});
