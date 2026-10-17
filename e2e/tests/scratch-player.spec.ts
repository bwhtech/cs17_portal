import { test, expect } from "@playwright/test";
import {
	CS17Cohort,
	CS17Profile,
	cleanupTestAssignments,
	cleanupTestSubmissions,
	createTestAssignment,
	createTestCohort,
	createTestProfile,
	createTestSubmission,
	deleteTestProfile,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { deleteDoc, updateDoc, uploadFile } from "../helpers/frappe";

test.describe("Scratch project player", () => {
	let cohort: CS17Cohort;
	let student: CS17Profile;

	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		student = await createTestProfile(request, {
			profileType: "Student",
			cohort: cohort.name,
		});
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestSubmissions(request);
		await cleanupTestAssignments(request);
		await deleteTestProfile(request, student.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("says so when a submitted file is not a Scratch project", async ({ page, request }) => {
		const scratch = await createTestAssignment(request, {
			cohort: cohort.name,
			submissionType: "Scratch",
		});
		const submission = await createTestSubmission(request, {
			assignment: scratch.name,
			student: student.name,
		});
		const uploaded = await uploadFile(request, {
			fileName: "notes.txt",
			content: Buffer.from("ls -la\n"),
			doctype: "CS17 Assignment Submission",
			docname: submission.name,
		});
		await updateDoc(request, "CS17 Assignment Submission", submission.name, {
			submission_document: uploaded.file_url,
		});

		await page.goto(`/dashboard/faculty/submissions/${submission.name}`);

		await expect(page.getByText("Could not open this project")).toBeVisible({
			timeout: 30000,
		});
		await expect(page.getByTitle("Scratch project player")).toBeHidden();
	});
});
