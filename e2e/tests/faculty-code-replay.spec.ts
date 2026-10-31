import { expect, test } from "@playwright/test";
import {
	CS17Cohort,
	TestStudent,
	cleanupTestAssignments,
	cleanupTestSubmissions,
	createTestAssignment,
	createTestCohort,
	createTestStudent,
	createTestSubmission,
	deleteTestProfile,
	deleteTestUser,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { createDoc, deleteDoc, getList, updateDoc } from "../helpers/frappe";

const FIRST_TRY = "for number in range(1, 11):\n    print(number)";
const PASTED = "for number in range(1, 11):\n    if number % 2 == 0:\n        print(number)";
const FINAL = "for number in range(2, 11, 2):\n    print(number)";

let cohort: CS17Cohort;
let student: TestStudent;
const projects: string[] = [];

test.describe("Code replay", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		student = await createTestStudent(request, cohort.name);
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestSubmissions(request, cohort.name);
		for (const project of projects) {
			await deleteDoc(request, "CS17 Project", project);
		}
		const pastes = await getList<{ name: string }>(request, "CS17 Paste", {
			fields: ["name"],
			filters: { student: student.profileName },
		});
		for (const paste of pastes) {
			await deleteDoc(request, "CS17 Paste", paste.name);
		}
		await cleanupTestAssignments(request, cohort.name);
		await deleteTestProfile(request, student.profileName);
		await deleteTestUser(request, student.email);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("replays the saves with the paste on the timeline", async ({ page, request }) => {
		const assignment = await createTestAssignment(request, {
			cohort: cohort.name,
			submissionType: "Python",
		});
		const project = await createDoc<{ name: string }>(request, "CS17 Project", {
			project_title: assignment.title,
			project_type: "Python",
			profile: student.profileName,
			assignment: assignment.name,
			code: FINAL,
		});
		projects.push(project.name);
		for (const snapshot of [
			{ saved_at: "2026-03-04 10:00:00", code: FIRST_TRY },
			{ saved_at: "2026-03-04 10:00:30", code: PASTED },
			{ saved_at: "2026-03-04 10:01:00", code: FINAL },
		]) {
			await createDoc(request, "CS17 Code Snapshot", {
				project: project.name,
				assignment: assignment.name,
				student: student.profileName,
				...snapshot,
			});
		}
		await createDoc(request, "CS17 Paste", {
			assignment: assignment.name,
			student: student.profileName,
			pasted_at: "2026-03-04 10:00:20",
			line_count: 3,
			character_count: PASTED.length,
			text: PASTED,
		});
		const submission = await createTestSubmission(request, {
			assignment: assignment.name,
			student: student.profileName,
		});
		await updateDoc(request, "CS17 Assignment Submission", submission.name, {
			project: project.name,
			code: FINAL,
		});

		await page.goto(`/dashboard/faculty/submissions/${submission.name}`);
		await page.getByRole("button", { name: "Replay", exact: true }).click();
		const replay = page.getByRole("dialog");
		const editor = replay.locator(".cm-content");
		await expect(editor).toContainText("print(number)");
		await expect(editor).not.toContainText("if number % 2 == 0:");

		await replay.getByRole("button", { name: /^Pasted 3 lines at/ }).click();
		await expect(editor).toContainText("if number % 2 == 0:");

		await replay.getByRole("button", { name: "Play", exact: true }).click();
		await expect(editor).toContainText("range(2, 11, 2)");
		await expect(replay.getByRole("button", { name: "Play", exact: true })).toBeVisible();
	});
});
