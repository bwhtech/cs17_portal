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

const STARTED = "number = int(input())";
const SOLUTION = [
	"number = int(input())",
	"total = 0",
	"for digit in str(number):",
	"    total += int(digit) ** len(str(number))",
	"if total == number:",
	"    print('Armstrong')",
	"else:",
	"    print('Not Armstrong')",
].join("\n");

let cohort: CS17Cohort;
let student: TestStudent;
const projects: string[] = [];

test.describe("Code appeared at once", () => {
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

	test("flags a solution that arrived in one save and opens the replay there", async ({
		page,
		request,
	}) => {
		const assignment = await createTestAssignment(request, {
			cohort: cohort.name,
			submissionType: "Python",
		});
		const project = await createDoc<{ name: string }>(request, "CS17 Project", {
			project_title: assignment.title,
			project_type: "Python",
			profile: student.profileName,
			assignment: assignment.name,
			code: SOLUTION,
		});
		projects.push(project.name);
		for (const snapshot of [
			{ saved_at: "2026-03-04 16:10:00", code: STARTED },
			{ saved_at: "2026-03-04 16:12:00", code: SOLUTION },
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
			pasted_at: "2026-03-04 16:11:50",
			line_count: 8,
			character_count: SOLUTION.length,
			text: SOLUTION,
		});
		const submission = await createTestSubmission(request, {
			assignment: assignment.name,
			student: student.profileName,
		});
		await updateDoc(request, "CS17 Assignment Submission", submission.name, {
			project: project.name,
			code: SOLUTION,
		});

		await page.goto(`/dashboard/faculty/assignments/${assignment.name}`);
		const flag = page.getByRole("link", { name: /right after a paste/ });
		await expect(flag).toHaveText("Check");
		await flag.click();

		await expect(page).toHaveURL(new RegExp(`/faculty/submissions/${submission.name}$`));
		await expect(page.getByText(/Most of the code arrived in one save at/)).toBeVisible();
		await page.getByRole("button", { name: "Show", exact: true }).click();
		const editor = page.getByRole("dialog").locator(".cm-content");
		await expect(editor).toContainText("print('Not Armstrong')");
	});
});
