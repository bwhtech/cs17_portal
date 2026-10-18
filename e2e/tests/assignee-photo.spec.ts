import { test, expect } from "@playwright/test";
import {
	CS17Cohort,
	CS17Profile,
	TEST_ASSIGNMENT_PREFIX,
	TestFaculty,
	createTestCohort,
	createTestFaculty,
	createTestProfile,
	createTestSubmission,
	deleteTestProfile,
	deleteTestUser,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { callMethod, deleteDoc, updateDoc, uploadFile } from "../helpers/frappe";

let sessionProfile: string | null;
let cohort: CS17Cohort;
let student: CS17Profile;
let faculty: TestFaculty;
let photo: string;
let assignment: string;
let submission: string;

test.describe("Assignee photo", () => {
	test.beforeAll(async ({ request }) => {
		sessionProfile = await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		student = await createTestProfile(request, {
			profileType: "Student",
			cohort: cohort.name,
		});
		faculty = await createTestFaculty(request);
		const upload = await uploadFile(request, {
			fileName: "avatar.png",
			content: Buffer.from(
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
				"base64"
			),
			doctype: "CS17 Profile",
			docname: faculty.profileName,
			isPrivate: false,
		});
		photo = upload.file_url;
		await updateDoc(request, "CS17 Profile", faculty.profileName, { profile_picture: photo });
		assignment = await callMethod<string>(request, "cs17_portal.api.create_assignment", {
			title: `${TEST_ASSIGNMENT_PREFIX} Assignee photo ${Date.now()}`,
			cohort: cohort.name,
			due_date: "2030-01-01 00:00:00",
		});
		const created = await createTestSubmission(request, {
			assignment,
			student: student.name,
		});
		submission = created.name;
		await callMethod(request, "cs17_portal.api.assign_submission", {
			submission,
			assign_to: faculty.email,
		});
	});

	test.afterAll(async ({ request }) => {
		await deleteTestProfile(request, faculty.profileName);
		await deleteTestUser(request, faculty.email);
		await deleteDoc(request, "CS17 Assignment Submission", submission);
		await deleteDoc(request, "CS17 Assignment", assignment);
		await deleteTestProfile(request, student.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
		if (sessionProfile) await deleteTestProfile(request, sessionProfile);
	});

	test("shows the assignee's photo in the Assigned to cell", async ({ page }) => {
		await page.goto(`/dashboard/faculty/assignments/${assignment}`);
		await expect(
			page.getByRole("button", { name: /^Assigned to / }).locator("img")
		).toHaveAttribute("src", photo);
	});
});
