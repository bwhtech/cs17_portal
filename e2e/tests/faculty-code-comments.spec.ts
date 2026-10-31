import { APIRequestContext, expect, test } from "@playwright/test";
import {
	CS17Cohort,
	CS17Submission,
	TestStudent,
	cleanupTestAssignments,
	cleanupTestGrades,
	cleanupTestSubmissions,
	createTestAssignment,
	createTestCohort,
	createTestStudent,
	createTestSubmission,
	deleteTestProfile,
	deleteTestUser,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { callMethod, deleteDoc, getList, updateDoc } from "../helpers/frappe";

const CODE = "total = 0\nfor price in prices:\n    total = total + price\nprint(total)\n";
const LINE_NUMBER = ".cm-lineNumbers .cm-gutterElement";

let cohort: CS17Cohort;
let student: TestStudent;
const submissions: string[] = [];

async function submitCode(request: APIRequestContext): Promise<CS17Submission> {
	const assignment = await createTestAssignment(request, {
		cohort: cohort.name,
		submissionType: "Python",
	});
	const submission = await createTestSubmission(request, {
		assignment: assignment.name,
		student: student.profileName,
	});
	await updateDoc(request, "CS17 Assignment Submission", submission.name, { code: CODE });
	submissions.push(submission.name);
	return submission;
}

test.describe("Comments on lines of code", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		student = await createTestStudent(request, cohort.name);
	});

	test.afterAll(async ({ request }) => {
		const comments = await getList<{ name: string }>(request, "CS17 Code Comment", {
			fields: ["name"],
			filters: { submission: ["in", submissions] },
		});
		for (const comment of comments) {
			await deleteDoc(request, "CS17 Code Comment", comment.name);
		}
		await cleanupTestGrades(request, cohort.name);
		await cleanupTestSubmissions(request, cohort.name);
		await cleanupTestAssignments(request, cohort.name);
		await deleteTestProfile(request, student.profileName);
		await deleteTestUser(request, student.email);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("adds, edits and deletes a comment on a line", async ({ page, request }) => {
		const submission = await submitCode(request);

		await page.goto(`/dashboard/faculty/submissions/${submission.name}`);
		await page.locator(LINE_NUMBER, { hasText: /^3$/ }).click();
		await page.getByLabel("Comment on line 3").fill("Use total += price here.");
		await page.getByRole("button", { name: "Save", exact: true }).click();
		await expect(page.getByText("Use total += price here.")).toBeVisible();
		await page.reload();
		await expect(page.getByText("Use total += price here.")).toBeVisible();

		await page.getByRole("button", { name: "Edit comment" }).click();
		await page.getByLabel("Comment on line 3").fill("Try sum(prices) instead.");
		await page.getByRole("button", { name: "Save", exact: true }).click();
		await expect(page.getByText("Try sum(prices) instead.")).toBeVisible();

		await page.getByRole("button", { name: "Delete comment" }).click();
		await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
		await expect(page.getByText("Try sum(prices) instead.")).toHaveCount(0);
	});

	test("shows the student the commented line once the remarks are published", async ({
		browser,
		request,
	}) => {
		const submission = await submitCode(request);
		await callMethod(request, "cs17_portal.code_comments.add_code_comment", {
			submission: submission.name,
			line: 3,
			comment: "Use total += price here.",
		});
		await callMethod(request, "cs17_portal.api.grade_submission", {
			submission: submission.name,
			remarks: "Works for every list.",
			publish: "now",
		});
		const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
		await context.request.post("/api/method/login", {
			form: { usr: student.email, pwd: student.password },
		});
		const page = await context.newPage();

		await page.goto(`/dashboard/assignments/${submission.assignment}/submission`);

		await expect(page.getByText("Line 3")).toBeVisible();
		await expect(page.getByText("total = total + price")).toBeVisible();
		await expect(page.getByText("Use total += price here.")).toBeVisible();
		await context.close();
	});
});
