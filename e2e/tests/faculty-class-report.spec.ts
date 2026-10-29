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

let cohort: CS17Cohort;
let otherCohort: CS17Cohort;
let onTimeStudent: CS17Profile;
let behindStudent: CS17Profile;

test.describe("Class report", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		otherCohort = await createTestCohort(request);
		onTimeStudent = await createTestProfile(request, { cohort: cohort.name });
		behindStudent = await createTestProfile(request, { cohort: cohort.name });
		const assignment = await createTestAssignment(request, {
			cohort: cohort.name,
			dueDate: "2026-01-02 00:00:00",
		});
		await createTestSubmission(request, {
			assignment: assignment.name,
			student: onTimeStudent.name,
		});
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestSubmissions(request, cohort.name);
		await cleanupTestAssignments(request, cohort.name);
		await deleteTestProfile(request, onTimeStudent.name);
		await deleteTestProfile(request, behindStudent.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
		await deleteDoc(request, "CS17 Cohort", otherCohort.name);
	});

	test("lists the student with missing work first and downloads the same rows", async ({
		page,
	}) => {
		await page.goto("/dashboard/faculty");
		await page.getByRole("link", { name: "Reports", exact: true }).click();
		await page.getByRole("combobox", { name: "Cohort" }).click();
		await page.getByRole("listbox").waitFor();
		await page.keyboard.type(cohort.name);
		await page.keyboard.press("Enter");

		await expect(page.locator(LIST_ROW)).toContainText([
			behindStudent.full_name!,
			onTimeStudent.full_name!,
		]);

		const href = await page.getByRole("link", { name: "Download" }).getAttribute("href");
		const lines = (await (await page.request.get(href!)).text()).split(/\r?\n/);
		expect(lines[1]).toContain(behindStudent.full_name!);
		expect(lines[2]).toContain(onTimeStudent.full_name!);
	});
});
