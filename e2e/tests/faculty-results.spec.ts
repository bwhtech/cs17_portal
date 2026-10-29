import { test, expect } from "@playwright/test";
import {
	CS17Cohort,
	TestResult,
	TestStudent,
	cleanupTestResult,
	createTestCohort,
	createTestResult,
	createTestStudent,
	deleteTestProfile,
	deleteTestUser,
} from "../helpers/cs17";
import { deleteDoc } from "../helpers/frappe";

const LIST_ROW = '[data-slot="list-row"]';

let cohort: CS17Cohort;
let student: TestStudent;
let result: TestResult;

test.describe("Faculty results", () => {
	test.beforeAll(async ({ request }) => {
		cohort = await createTestCohort(request);
		student = await createTestStudent(request, cohort.name);
		result = await createTestResult(request, {
			cohort: cohort.name,
			student: student.profileName,
			marksObtained: 82,
			maxMarks: 100,
		});
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestResult(request, result);
		await deleteTestProfile(request, student.profileName);
		await deleteTestUser(request, student.email);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("opens a student's result from the Results page", async ({ page }) => {
		const row = page.locator(LIST_ROW, { hasText: result.examName });

		await page.goto("/dashboard/faculty");
		await page.getByRole("link", { name: "Results", exact: true }).click();
		await expect(row).toContainText("82 / 100");
		await expect(row).toContainText("Published");

		await row.getByRole("link").click();
		await expect(page).toHaveURL(new RegExp(`/dashboard/faculty/results/${result.result}$`));
		await expect(page.locator(LIST_ROW, { hasText: result.subjectName })).toContainText(
			"82 / 100"
		);
	});
});
