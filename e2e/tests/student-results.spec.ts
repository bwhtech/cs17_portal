import * as fs from "fs";
import { test, expect } from "@playwright/test";
import {
	TestResult,
	cleanupTestResult,
	createTestResult,
	createTestStudent,
	deleteTestProfile,
	deleteTestUser,
} from "../helpers/cs17";

interface StudentInfo {
	email: string;
	cohort: string;
	cohortName: string;
	profileName: string;
}

const MAX_MARKS = 100;
const MARKS_OBTAINED = 82;

/** A frappe-ui List row is a div with a `list-row` slot, not a `<tr>`. */
function listRow(page: import("@playwright/test").Page, text: string) {
	return page.locator('[data-slot="list-row"]').filter({ hasText: text });
}

test.describe("Student results", () => {
	let student: StudentInfo;
	let own: TestResult;
	/** A second student's published result, to prove one cannot read another's. */
	let other: TestResult;
	let otherStudent: { email: string; profileName: string };

	test.beforeAll(async ({ request }) => {
		student = JSON.parse(
			fs.readFileSync("e2e/.auth/student-info.json", "utf-8"),
		);

		own = await createTestResult(request, {
			cohort: student.cohort,
			student: student.profileName,
			marksObtained: MARKS_OBTAINED,
			maxMarks: MAX_MARKS,
		});

		otherStudent = await createTestStudent(request, student.cohort);
		other = await createTestResult(request, {
			cohort: student.cohort,
			student: otherStudent.profileName,
		});
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestResult(request, own);
		await cleanupTestResult(request, other);
		await deleteTestProfile(request, otherStudent.profileName);
		await deleteTestUser(request, otherStudent.email);
	});

	test("lists the student's own published result", async ({ page }) => {
		await page.goto("/dashboard/results");

		const row = listRow(page, own.examName);
		await expect(row).toBeVisible();
		await expect(row).toContainText(`${MARKS_OBTAINED} / ${MAX_MARKS}`);
		await expect(row).toContainText("82%");
		await expect(row).toContainText("Pass");
	});

	test("opens the report card with its subject breakdown", async ({ page }) => {
		await page.goto("/dashboard/results");
		await page.getByRole("link", { name: own.examName }).click();

		await expect(page).toHaveURL(new RegExp(`/dashboard/results/${own.result}$`));
		await expect(
			page.getByRole("heading", { name: own.examName, level: 1 }),
		).toBeVisible();
		await expect(page.getByText("Total marks")).toBeVisible();
		await expect(page.getByText(`${MARKS_OBTAINED} / ${MAX_MARKS}`).first()).toBeVisible();

		const subject = listRow(page, own.subjectName);
		await expect(subject).toContainText(`${MARKS_OBTAINED} / ${MAX_MARKS}`);
		await expect(subject).toContainText("Pass");
	});

	test("refuses another student's result", async ({ page }) => {
		const response = await page.request.get(
			`/api/v2/method/cs17_portal.api.get_student_result?result=${other.result}`,
		);
		expect(response.status()).toBe(403);

		await page.goto(`/dashboard/results/${other.result}`);
		await expect(page.getByText("This result is not available")).toBeVisible();
		await expect(page.getByText(other.subjectName)).toHaveCount(0);
	});
});
