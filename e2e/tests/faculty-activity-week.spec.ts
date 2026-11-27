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
let idleStudent: CS17Profile;
let busyStudent: CS17Profile;
let run: string;

test.describe("Class activity week", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		idleStudent = await createTestProfile(request, { cohort: cohort.name });
		busyStudent = await createTestProfile(request, { cohort: cohort.name });
		const assignment = await createTestAssignment(request, {
			cohort: cohort.name,
			submissionType: "Python",
		});
		const { date } = await callGetMethod<{ date: string }>(
			request,
			"cs17_portal.activity_week.get_class_activity_week",
			{ cohort: cohort.name }
		);
		run = (
			await createDoc<{ name: string }>(request, "CS17 Code Run", {
				assignment: assignment.name,
				student: busyStudent.name,
				ran_at: `${date} 00:00:01`,
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

	test("lists the student with no work all week first and marks the day the other one ran code", async ({
		page,
	}) => {
		await page.goto("/dashboard/faculty");
		await page.getByRole("link", { name: "Activity", exact: true }).click();
		await page.getByRole("combobox", { name: "Cohort" }).click();
		await page.getByRole("listbox").waitFor();
		await page.keyboard.type(cohort.name);
		await page.keyboard.press("Enter");
		await page.getByRole("radio", { name: "Week" }).click();

		const rows = page.getByRole("table", { name: "Activity this week" }).getByRole("row");
		await expect(rows.nth(1)).toContainText(idleStudent.full_name!);
		await expect(
			rows.nth(2).getByRole("cell", { name: /1 opened, 1 typed or ran, 0 submitted/ })
		).toHaveCount(1);
	});

	test("opens what the student did on a day", async ({ page }) => {
		await page.goto("/dashboard/faculty/activity");
		await page.getByRole("combobox", { name: "Cohort" }).click();
		await page.getByRole("listbox").waitFor();
		await page.keyboard.type(cohort.name);
		await page.keyboard.press("Enter");
		await page.getByRole("radio", { name: "Week" }).click();

		await page.getByRole("button", { name: /1 opened, 1 typed or ran, 0 submitted/ }).click();

		await expect(page.getByRole("dialog")).toContainText("12:00 AM · 1 run");
	});
});
