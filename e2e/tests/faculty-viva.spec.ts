import { test, expect } from "@playwright/test";
import {
	CS17Cohort,
	TEST_EXAM_PREFIX,
	TestStudent,
	createTestCohort,
	createTestStudent,
	deleteTestProfile,
	deleteTestUser,
} from "../helpers/cs17";
import { createDoc, deleteDoc, getList } from "../helpers/frappe";

const LIST_ROW = '[data-slot="list-row"]';
const suffix = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
const examName = `${TEST_EXAM_PREFIX} ${suffix}`;

let cohort: CS17Cohort;
let student: TestStudent;
let subject: string;
let scale: string;
let exam: string;
let viva: string;

test.describe("Faculty viva", () => {
	test.beforeAll(async ({ request }) => {
		cohort = await createTestCohort(request);
		student = await createTestStudent(request, cohort.name);
		subject = (
			await createDoc<{ name: string }>(request, "CS17 Subject", {
				subject_code: `E2E-${suffix}`,
				subject_name: `E2E Subject ${suffix}`,
				is_active: 1,
			})
		).name;
		scale = (
			await createDoc<{ name: string }>(request, "CS17 Grading Scale", {
				scale_name: `E2E Scale ${suffix}`,
				passing_percentage: 40,
				bands: [
					{ grade: "F", min_percent: 0, max_percent: 39.99 },
					{ grade: "P", min_percent: 40, max_percent: 100 },
				],
			})
		).name;
		exam = (
			await createDoc<{ name: string }>(request, "CS17 Exam", {
				exam_name: examName,
				cohort: cohort.name,
				grading_scale: scale,
				subjects: [{ subject, max_marks: 5, grading_scale: scale }],
			})
		).name;
		viva = (
			await createDoc<{ name: string }>(request, "CS17 Viva", {
				exam,
				subject,
				component: "Total",
				questions: [
					{
						section: "Program",
						question: "Tell me exactly what shows on screen when this runs.",
						code: 'score = 17\nprint(score // 5, score % 5, end=", ")\nprint("Total:", scroe + 1)',
						answer: "3 2, then a NameError on line 3",
						marks: 3,
					},
					{
						section: "Basics",
						question: "What do 7 // 2 and 7 % 2 give?",
						answer: "3 and 1",
						marks: 1,
					},
					{
						section: "Loops",
						question: "What numbers does range(5) give?",
						answer: "0 1 2 3 4",
						marks: 1,
					},
				],
			})
		).name;
	});

	test.afterAll(async ({ request }) => {
		const vivaMarks = await getList<{ name: string }>(request, "CS17 Viva Mark", {
			filters: { viva },
		});
		const subjectMarks = await getList<{ name: string }>(request, "CS17 Subject Marks", {
			filters: { exam },
		});
		for (const [doctype, name] of [
			...vivaMarks.map((row) => ["CS17 Viva Mark", row.name] as const),
			...subjectMarks.map((row) => ["CS17 Subject Marks", row.name] as const),
			["CS17 Viva", viva],
			["CS17 Exam", exam],
			["CS17 Subject", subject],
			["CS17 Grading Scale", scale],
		] as const) {
			await deleteDoc(request, doctype, name);
		}
		await deleteTestProfile(request, student.profileName);
		await deleteTestUser(request, student.email);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("marks a student's viva into their subject marks", async ({ page, request }) => {
		await page.goto("/dashboard/faculty");
		await page.getByRole("link", { name: "Viva", exact: true }).click();
		await page.locator(LIST_ROW, { hasText: examName }).click();
		await page.locator(LIST_ROW, { hasText: "Not yet" }).click();

		const dialog = page.getByRole("dialog");
		await expect(dialog).toContainText('print("Total:", scroe + 1)');
		await expect(dialog).not.toContainText("NameError on line 3");
		await dialog.getByRole("button", { name: "Show answer" }).first().click();
		await expect(dialog).toContainText("NameError on line 3");

		await dialog.getByRole("button", { name: "Save" }).click();
		await expect(dialog).toContainText("Give marks for Program, Basics, Loops.");

		await dialog
			.getByRole("radiogroup", { name: "Marks for Program" })
			.getByRole("radio", { name: "2" })
			.click();
		await dialog
			.getByRole("radiogroup", { name: "Marks for Basics" })
			.getByRole("radio", { name: "1" })
			.click();
		await dialog
			.getByRole("radiogroup", { name: "Marks for Loops" })
			.getByRole("radio", { name: "1" })
			.click();
		await dialog.getByRole("button", { name: "Save" }).click();

		await expect(page.locator(LIST_ROW, { hasText: "Done" })).toContainText("4 / 5");
		const [marks] = await getList<{ total_marks_obtained: number }>(
			request,
			"CS17 Subject Marks",
			{
				fields: ["total_marks_obtained"],
				filters: { exam },
			}
		);
		expect(marks.total_marks_obtained).toBe(4);
	});
});
