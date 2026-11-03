import * as fs from "fs";
import { APIRequestContext, expect, test } from "@playwright/test";
import { CS17Assignment, TEST_ASSIGNMENT_PREFIX, ensureSessionFaculty } from "../helpers/cs17";
import { createDoc, deleteDoc, getList } from "../helpers/frappe";
import { callAsStudent } from "../helpers/student";

const CORRECT_PROGRAM = "n = int(input())\nprint(n * n)";
const CAPTION = "Flawless. Every test, even the hidden ones. First try.";

async function deleteLinked(request: APIRequestContext, doctype: string, assignment: string) {
	const rows = await getList<{ name: string }>(request, doctype, {
		fields: ["name"],
		filters: { assignment },
		limit: 50,
	});
	for (const row of rows) await deleteDoc(request, doctype, row.name);
}

test.describe("Celebrating a solved question", () => {
	let student: string;
	let cohort: string;
	let assignment: CS17Assignment;

	test.beforeAll(async ({ request }) => {
		({ profileName: student, cohort } = JSON.parse(
			fs.readFileSync("e2e/.auth/student-info.json", "utf-8")
		));
		await ensureSessionFaculty(request);
	});

	test.beforeEach(async ({ request }) => {
		assignment = await createDoc<CS17Assignment>(request, "CS17 Assignment", {
			title: `${TEST_ASSIGNMENT_PREFIX} Squares ${Date.now()}`,
			cohort,
			submission_type: "Python",
			assignment_type: "Graded",
			remarks: "Marks",
			max_marks: 10,
			due_date: "2030-01-01 00:00:00",
			is_published: 1,
			test_cases: [
				{ input: "3\n", expected_output: "9\n", is_hidden: 0 },
				{ input: "4\n", expected_output: "16\n", is_hidden: 1 },
			],
		});
	});

	test.afterEach(async ({ request }) => {
		for (const doctype of [
			"CS17 Assignment Grade",
			"CS17 Assignment Submission",
			"CS17 Code Run",
			"CS17 Project",
		])
			await deleteLinked(request, doctype, assignment.name);
		await deleteDoc(request, "CS17 Assignment", assignment.name);
	});

	async function gradeFullMarks(request: APIRequestContext) {
		const submission = await createDoc<{ name: string }>(
			request,
			"CS17 Assignment Submission",
			{
				assignment: assignment.name,
				student,
				code: CORRECT_PROGRAM,
				submitted_at: "2026-01-01 10:00:00",
			}
		);
		await createDoc(request, "CS17 Assignment Grade", {
			assignment: assignment.name,
			submission: submission.name,
			marks_obtained: 10,
			is_published: 1,
		});
	}

	test("shows a line from the Zen of Python when the examples pass", async ({ page }) => {
		await page.goto("/dashboard");
		const project = await callAsStudent(page, "cs17_portal.api.start_python_assignment", {
			assignment: assignment.name,
		});
		await page.goto(
			`/dashboard/projects/${project.body.message.name}/code?assignment=${assignment.name}`
		);
		await page.locator(".cm-content").fill(CORRECT_PROGRAM);
		const tests = page.getByRole("tabpanel", { name: "Tests" });

		await page.getByRole("button", { name: "Run tests" }).click();
		await expect(tests).toContainText("1 of 1 test passed", { timeout: 60000 });
		const firstLine = await tests.getByRole("blockquote").textContent();
		await page.getByRole("button", { name: "Run tests" }).click();

		await expect.poll(() => tests.getByRole("blockquote").textContent()).not.toBe(firstLine);
	});

	test("celebrates a full marks grade with the snake", async ({ page, request }) => {
		await gradeFullMarks(request);

		await page.goto(`/dashboard/assignments/${assignment.name}/submission`);

		await expect(page.getByText(CAPTION)).toBeVisible();
		await expect(page.getByText("import antigravity")).toBeVisible();
	});

	test("shows a still badge when motion is reduced", async ({ page, request }) => {
		await gradeFullMarks(request);
		await page.emulateMedia({ reducedMotion: "reduce" });

		await page.goto(`/dashboard/assignments/${assignment.name}/submission`);

		await expect(page.getByText("Flawless, first try", { exact: true })).toBeVisible();
		await expect(
			page.getByText("Every test, even the hidden ones.", { exact: true })
		).toBeVisible();
	});
});
