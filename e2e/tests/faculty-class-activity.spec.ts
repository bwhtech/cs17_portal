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

const LIST_ROW = '[data-slot="list-row"]';

let cohort: CS17Cohort;
let idleStudent: CS17Profile;
let busyStudent: CS17Profile;
let run: string;
let assignmentTitle: string;

test.describe("Class activity", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		idleStudent = await createTestProfile(request, { cohort: cohort.name });
		busyStudent = await createTestProfile(request, { cohort: cohort.name });
		const assignment = await createTestAssignment(request, {
			cohort: cohort.name,
			submissionType: "Python",
		});
		assignmentTitle = assignment.title;
		const { date } = await callGetMethod<{ date: string }>(
			request,
			"cs17_portal.class_activity.get_class_activity",
			{ cohort: cohort.name }
		);
		run = (
			await createDoc<{ name: string }>(request, "CS17 Code Run", {
				assignment: assignment.name,
				student: busyStudent.name,
				ran_at: `${date} 00:00:01`,
				passed: 1,
				total: 2,
			})
		).name;
	});

	test.afterAll(async ({ request }) => {
		await deleteDoc(request, "CS17 Code Run", run);
		await cleanupTestAssignments(request, cohort.name);
		await deleteTestProfile(request, idleStudent.name);
		await deleteTestProfile(request, busyStudent.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("lists the student with no work first and shows what the other one did", async ({
		page,
	}) => {
		await page.goto("/dashboard/faculty");
		await page.getByRole("link", { name: "Activity", exact: true }).click();
		await page.getByRole("combobox", { name: "Cohort" }).click();
		await page.getByRole("listbox").waitFor();
		await page.keyboard.type(cohort.name);
		await page.keyboard.press("Enter");

		const rows = page.locator(LIST_ROW);
		await expect(rows).toContainText([idleStudent.full_name!, busyStudent.full_name!]);
		await expect(rows.first()).toContainText("No work");

		await rows
			.nth(1)
			.getByRole("button", { name: busyStudent.full_name, exact: true })
			.click();

		await expect(page.getByRole("dialog")).toContainText(
			/\d{1,2}:\d{2} [AP]M · 1 run, 1 of 2 tests passed/
		);
	});

	test("shows the assignment a student has not started", async ({ page }) => {
		await page.goto("/dashboard/faculty/activity");
		await page.getByRole("combobox", { name: "Cohort" }).click();
		await page.getByRole("listbox").waitFor();
		await page.keyboard.type(cohort.name);
		await page.keyboard.press("Enter");

		await page.getByRole("button", { name: idleStudent.full_name, exact: true }).click();

		const dialog = page.getByRole("dialog");
		await expect(dialog.getByRole("region", { name: "Day timeline" })).toBeVisible();
		await expect(dialog).toContainText(`Not started${assignmentTitle}`);
	});
});
