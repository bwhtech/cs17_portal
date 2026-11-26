import { APIRequestContext, expect, test, type Page } from "@playwright/test";
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
let stuckStudent: CS17Profile;
let steadyStudent: CS17Profile;
let topic: { name: string };
let assignment: CS17Assignment;
const runs: string[] = [];

function daysAgoAt(minutes: number): string {
	const at = new Date(Date.now() - 2 * 24 * 60 * 60_000 + minutes * 60_000);
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(
		at.getHours()
	)}:${pad(at.getMinutes())}:00`;
}

async function addRun(
	request: APIRequestContext,
	minutes: number,
	result: Record<string, unknown>
) {
	const run = await createDoc<{ name: string }>(request, "CS17 Code Run", {
		assignment: assignment.name,
		student: stuckStudent.name,
		ran_at: daysAgoAt(minutes),
		...result,
	});
	runs.push(run.name);
}

function stuckSection(page: Page) {
	return page.locator("section", {
		has: page.getByRole("heading", { name: "Stuck", exact: true }),
	});
}

test.describe("Stuck history", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		stuckStudent = await createTestProfile(request, { cohort: cohort.name });
		steadyStudent = await createTestProfile(request, { cohort: cohort.name });
		topic = await createDoc(request, "CS17 Topic", { topic_name: `Loops ${cohort.name}` });
		assignment = await createTestAssignment(request, {
			cohort: cohort.name,
			submissionType: "Python",
			topic: topic.name,
		});
		await addRun(request, 0, { error_type: "NameError", error_line: 4 });
		await addRun(request, 3, { error_type: "NameError", error_line: 4 });
		await addRun(request, 7, { passed: 2, total: 2 });
	});

	test.afterAll(async ({ request }) => {
		for (const run of runs) await deleteDoc(request, "CS17 Code Run", run);
		await cleanupTestAssignments(request, cohort.name);
		await deleteDoc(request, "CS17 Topic", topic.name);
		await deleteTestProfile(request, stuckStudent.name);
		await deleteTestProfile(request, steadyStudent.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("lists a spell under its topic with how long, the error and that they got past it", async ({
		page,
	}) => {
		await page.goto(`/dashboard/faculty/students/${stuckStudent.name}`);

		const section = stuckSection(page);
		await expect(section.getByRole("heading", { name: topic.name })).toBeVisible();
		await expect(section).toContainText(assignment.title);
		await expect(section).toContainText("7 min");
		await expect(section).toContainText("NameError on line 4");
		await expect(section).toContainText("Got past");
	});

	test("says so when the student was not stuck", async ({ page }) => {
		await page.goto(`/dashboard/faculty/students/${steadyStudent.name}`);

		await expect(stuckSection(page)).toContainText("Not stuck in the last 30 days.");
	});
});
