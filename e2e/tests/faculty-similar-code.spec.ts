import { APIRequestContext, expect, test } from "@playwright/test";
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
import { deleteDoc, updateDoc } from "../helpers/frappe";

let cohort: CS17Cohort;
let firstStudent: CS17Profile;
let secondStudent: CS17Profile;
let assignment: CS17Assignment;
let secondSubmission: CS17Submission;

async function submitCode(
	request: APIRequestContext,
	student: CS17Profile,
	code: string
): Promise<CS17Submission> {
	const submission = await createTestSubmission(request, {
		assignment: assignment.name,
		student: student.name,
	});
	await updateDoc(request, "CS17 Assignment Submission", submission.name, { code });
	return submission;
}

test.describe("Similar code", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		firstStudent = await createTestProfile(request, { cohort: cohort.name });
		secondStudent = await createTestProfile(request, { cohort: cohort.name });
		assignment = await createTestAssignment(request, {
			cohort: cohort.name,
			submissionType: "Python",
		});
		await submitCode(request, firstStudent, "total = price * quantity\nprint(total)\n");
		secondSubmission = await submitCode(
			request,
			secondStudent,
			"# work out the bill\ntotal=price*quantity\n\nprint(total)\n"
		);
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestSubmissions(request, cohort.name);
		await cleanupTestAssignments(request, cohort.name);
		await deleteTestProfile(request, firstStudent.name);
		await deleteTestProfile(request, secondStudent.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("lists near identical code and links to the grading page", async ({ page }) => {
		await page.goto(`/dashboard/faculty/assignments/${assignment.name}`);
		await page.getByRole("button", { name: "Similar code" }).click();
		const dialog = page.getByRole("dialog");
		await expect(dialog.getByText("100%")).toBeVisible();
		await dialog.getByRole("link", { name: secondStudent.full_name! }).click();

		await expect(page).toHaveURL(new RegExp(`/faculty/submissions/${secondSubmission.name}$`));
	});

	test("flags a submission with its closest match and opens its pairs", async ({ page }) => {
		await page.goto(`/dashboard/faculty/assignments/${assignment.name}`);
		await page.getByRole("button", { name: `100% like ${secondStudent.full_name}` }).click();
		const dialog = page.getByRole("dialog", {
			name: `Similar code: ${firstStudent.full_name}`,
		});

		await expect(dialog.getByRole("link", { name: secondStudent.full_name! })).toBeVisible();
	});

	test("flags the closest match on the phone cards", async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(`/dashboard/faculty/assignments/${assignment.name}`);

		await expect(
			page.getByRole("button", { name: `100% like ${firstStudent.full_name}` })
		).toBeVisible();
	});

	test("offers no similar code check on other assignment types", async ({ page, request }) => {
		const pdfAssignment = await createTestAssignment(request, {
			cohort: cohort.name,
			submissionType: "PDF",
		});
		await page.goto(`/dashboard/faculty/assignments/${pdfAssignment.name}`);
		await expect(page.getByRole("button", { name: "Copy submission link" })).toBeVisible();

		await expect(page.getByRole("button", { name: "Similar code" })).toHaveCount(0);
	});
});
