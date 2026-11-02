import { test, expect, type Page } from "@playwright/test";
import {
	CS17Assignment,
	CS17Cohort,
	CS17Profile,
	TEST_ASSIGNMENT_PREFIX,
	cleanupTestAssignments,
	cleanupTestGrades,
	cleanupTestSubmissions,
	createTestCohort,
	createTestProfile,
	createTestSubmission,
	deleteTestProfile,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { createDoc, deleteDoc } from "../helpers/frappe";

function topicRow(page: Page, topic: string) {
	return page
		.locator("section", { has: page.getByRole("heading", { name: "By topic" }) })
		.getByRole("listitem")
		.filter({ hasText: topic });
}

let cohort: CS17Cohort;
let student: CS17Profile;
let topic: { name: string };

test.describe("Progress by topic", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		student = await createTestProfile(request, { cohort: cohort.name });
		topic = await createDoc(request, "CS17 Topic", { topic_name: `Loops ${cohort.name}` });
		const assignment = await createDoc<CS17Assignment>(request, "CS17 Assignment", {
			title: `${TEST_ASSIGNMENT_PREFIX} Loops practice ${Date.now()}`,
			cohort: cohort.name,
			submission_type: "Any",
			assignment_type: "Graded",
			remarks: "Marks",
			max_marks: 20,
			topic: topic.name,
			due_date: "2030-01-01 00:00:00",
			is_published: 1,
		});
		const submission = await createTestSubmission(request, {
			assignment: assignment.name,
			student: student.name,
		});
		await createDoc(request, "CS17 Assignment Grade", {
			assignment: assignment.name,
			submission: submission.name,
			marks_obtained: 15,
			is_published: 1,
		});
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestGrades(request, cohort.name);
		await cleanupTestSubmissions(request, cohort.name);
		await cleanupTestAssignments(request, cohort.name);
		await deleteDoc(request, "CS17 Topic", topic.name);
		await deleteTestProfile(request, student.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("the class report shows the class average per topic", async ({ page }) => {
		await page.goto("/dashboard/faculty/reports");
		await page.getByRole("combobox", { name: "Cohort" }).click();
		await page.getByRole("listbox").waitFor();
		await page.keyboard.type(cohort.name);
		await page.keyboard.press("Enter");

		await expect(topicRow(page, topic.name)).toContainText("75%");
		await expect(topicRow(page, topic.name)).toContainText("1 of 1 submitted");
	});

	test("the student page shows the student's average per topic", async ({ page }) => {
		await page.goto(`/dashboard/faculty/students/${student.name}`);

		await expect(topicRow(page, topic.name)).toContainText("75%");
		await expect(topicRow(page, topic.name)).toContainText("1 of 1 submitted");
	});
});
