import { test, expect, type Page } from "@playwright/test";
import {
	CS17Assignment,
	CS17Cohort,
	CS17Profile,
	CS17Submission,
	cleanupTestAssignments,
	cleanupTestSubmissions,
	createTestAssignment,
	createTestCohort,
	createTestProfile,
	createTestSubmission,
	deleteTestProfile,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { deleteDoc, getDoc, updateDoc } from "../helpers/frappe";

const LIST_ROW = '[data-slot="list-row"]';

async function fillDateTime(page: Page, label: string, value: string) {
	const input = page.getByRole("combobox", { name: label });
	await input.fill(value);
	await input.press("Enter");
}

let cohort: CS17Cohort;
let student: CS17Profile;
let assignment: CS17Assignment;
let submission: CS17Submission;

test.describe("Late work", () => {
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
			max_marks: 20,
			due_date: "2025-12-31 00:00:00",
			late_until: "2030-01-01 00:00:00",
			late_penalty: 10,
		});
		submission = await createTestSubmission(request, {
			assignment: assignment.name,
			student: student.name,
		});
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestSubmissions(request, cohort.name);
		await cleanupTestAssignments(request, cohort.name);
		await deleteTestProfile(request, student.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("marks a submission made after the due date", async ({ page }) => {
		await page.goto(`/dashboard/faculty/assignments/${assignment.name}`);

		await expect(
			page
				.locator(LIST_ROW, { hasText: student.full_name })
				.getByText("Late", { exact: true })
		).toBeVisible();
	});

	test("shows the marks after the late penalty while grading", async ({ page }) => {
		await page.goto(`/dashboard/faculty/submissions/${submission.name}`);
		await page.getByLabel("Marks obtained").fill("20");

		await expect(page.getByText("Submitted late. 10% penalty: 18 of 20.")).toBeVisible();
	});

	test("accepts late work from the Timing dialog", async ({ page, request }) => {
		const onTime = await createTestAssignment(request, { cohort: cohort.name });

		await page.goto(`/dashboard/faculty/assignments/${onTime.name}`);
		await page.getByRole("button", { name: "Timing", exact: true }).click();
		await fillDateTime(page, "Accept late work until", "2030-01-08 09:00:00");
		await page.getByLabel("Late penalty (%)").fill("10");
		await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();

		await expect
			.poll(async () => {
				const saved = await getDoc<{ late_until: string; late_penalty: number }>(
					request,
					"CS17 Assignment",
					onTime.name
				);
				return [saved.late_until, saved.late_penalty];
			})
			.toEqual(["2030-01-08 09:00:00", 10]);
	});
});
