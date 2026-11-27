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
let students: CS17Profile[];
let topic: { name: string };
let assignment: CS17Assignment;
let runs: string[];

test.describe("Common errors", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		students = [
			await createTestProfile(request, { cohort: cohort.name }),
			await createTestProfile(request, { cohort: cohort.name }),
		];
		topic = await createDoc(request, "CS17 Topic", { topic_name: `Loops ${cohort.name}` });
		assignment = await createTestAssignment(request, {
			cohort: cohort.name,
			submissionType: "Python",
			topic: topic.name,
		});
		runs = [];
		for (const student of students) {
			const run = await createDoc<{ name: string }>(request, "CS17 Code Run", {
				assignment: assignment.name,
				student: student.name,
				ran_at: "2026-01-05 10:00:00",
				error_type: "EOFError",
				error_line: 3,
			});
			runs.push(run.name);
		}
	});

	test.afterAll(async ({ request }) => {
		for (const run of runs) await deleteDoc(request, "CS17 Code Run", run);
		await cleanupTestAssignments(request, cohort.name);
		await deleteDoc(request, "CS17 Topic", topic.name);
		for (const student of students) await deleteTestProfile(request, student.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("shows how many students hit an error and opens its live lab", async ({ page }) => {
		await page.goto("/dashboard/faculty/reports");
		await page.getByRole("combobox", { name: "Cohort" }).click();
		await page.getByRole("listbox").waitFor();
		await page.keyboard.type(cohort.name);
		await page.keyboard.press("Enter");

		const section = page.locator("section", {
			has: page.getByRole("heading", { name: "Common errors" }),
		});
		await expect(section).toContainText(topic.name);
		const row = section.locator(LIST_ROW).filter({ hasText: "EOFError on line 3" });
		await expect(row).toContainText(assignment.title);
		await expect(row).toContainText("2");

		await row.click();

		await expect(page).toHaveURL(new RegExp(`/faculty/assignments/${assignment.name}/live`));
	});
});
