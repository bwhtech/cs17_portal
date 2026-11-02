import { test, expect } from "@playwright/test";
import {
	CS17Assignment,
	CS17Cohort,
	CS17Profile,
	CS17Submission,
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
import { deleteDoc, getList, updateDoc } from "../helpers/frappe";

const LIST_ROW = '[data-slot="list-row"]';

let cohort: CS17Cohort;
let student: CS17Profile;
let assignment: CS17Assignment;
let submission: CS17Submission;

test.describe("Rubric grading", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		student = await createTestProfile(request, { cohort: cohort.name });
		assignment = await createTestAssignment(request, {
			cohort: cohort.name,
			assignmentType: "Graded",
		});
		await updateDoc(request, "CS17 Assignment", assignment.name, {
			remarks: "Marks",
			rubric: [
				{ criterion: "Logic", marks: 5 },
				{ criterion: "Style", marks: 15 },
			],
		});
		submission = await createTestSubmission(request, {
			assignment: assignment.name,
			student: student.name,
		});
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestGrades(request, cohort.name);
		await cleanupTestSubmissions(request, cohort.name);
		await cleanupTestAssignments(request, cohort.name);
		await deleteTestProfile(request, student.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("makes the rubric total the max marks of a new assignment", async ({ page }) => {
		await page.goto("/dashboard/faculty/assignments");
		await page.getByRole("button", { name: "New Assignment" }).click();
		await page.getByRole("combobox").filter({ hasText: "Non-graded" }).click();
		await page.getByRole("option", { name: "Marks", exact: true }).click();

		await page.getByRole("button", { name: "Add criterion" }).click();
		await page.getByRole("button", { name: "Add criterion" }).click();
		await page.getByLabel("Marks", { exact: true }).nth(0).fill("5");
		await page.getByLabel("Marks", { exact: true }).nth(1).fill("15");

		await expect(page.getByLabel("Max Marks", { exact: true })).toHaveValue("20");
	});

	test("asks for each criterion in the grade dialog", async ({ page }) => {
		await page.goto(`/dashboard/faculty/assignments/${assignment.name}`);
		await page
			.locator(LIST_ROW, { hasText: student.full_name })
			.getByRole("button", { name: "Grade", exact: true })
			.click();

		await expect(
			page.getByRole("dialog").getByLabel("Style, out of 15", { exact: true })
		).toBeVisible();
	});

	test("refuses more than a criterion's marks on its field", async ({ page }) => {
		await page.goto(`/dashboard/faculty/submissions/${submission.name}`);
		await page.getByLabel("Logic, out of 5", { exact: true }).fill("6");
		await page.getByLabel("Style, out of 15", { exact: true }).fill("12");
		await page.getByRole("button", { name: /^(Save|Update) grade$/ }).click();

		await expect(page.getByText("Marks cannot exceed 5.")).toBeVisible();
	});

	test("saves the total of the criterion marks", async ({ page, request }) => {
		await page.goto(`/dashboard/faculty/submissions/${submission.name}`);
		await page.getByLabel("Logic, out of 5", { exact: true }).fill("4");
		await page.getByLabel("Style, out of 15", { exact: true }).fill("12");
		await expect(page.getByText("Total 16 of 20")).toBeVisible();
		await page.getByRole("button", { name: /^(Save|Update) grade$/ }).click();

		await expect
			.poll(async () => {
				const [grade] = await getList<{ marks_obtained: number }>(
					request,
					"CS17 Assignment Grade",
					{ fields: ["marks_obtained"], filters: { submission: submission.name } }
				);
				return grade?.marks_obtained;
			})
			.toBe(16);
	});
});
