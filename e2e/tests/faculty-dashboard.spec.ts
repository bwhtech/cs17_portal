import * as fs from "fs";
import { test, expect } from "@playwright/test";
import {
	CS17Assignment,
	CS17Cohort,
	CS17Profile,
	TestFaculty,
	createTestAssignment,
	createTestCohort,
	createTestProfile,
	createTestSubmission,
	deleteTestProfile,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { callMethod, deleteDoc, getList } from "../helpers/frappe";

let sessionProfile: string | null;
let cohort: CS17Cohort;
let assignment: CS17Assignment;
const students: CS17Profile[] = [];
const submissions: string[] = [];

test.describe("Faculty dashboard", () => {
	test.beforeAll(async ({ request }) => {
		const faculty: TestFaculty = JSON.parse(
			fs.readFileSync("e2e/.auth/faculty-info.json", "utf-8")
		);
		sessionProfile = await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		assignment = await createTestAssignment(request, { cohort: cohort.name });
		for (let n = 0; n < 6; n++) {
			const student = await createTestProfile(request, {
				profileType: "Student",
				cohort: cohort.name,
			});
			students.push(student);
			const submission = await createTestSubmission(request, {
				assignment: assignment.name,
				student: student.name,
			});
			submissions.push(submission.name);
		}
		await callMethod(request, "cs17_portal.api.assign_submissions", {
			submissions,
			assign_to: faculty.email,
		});
	});

	test.afterAll(async ({ request }) => {
		const todos = await getList<{ name: string }>(request, "ToDo", {
			fields: ["name"],
			filters: {
				reference_type: "CS17 Assignment Submission",
				reference_name: ["in", submissions],
			},
		});
		for (const todo of todos) await deleteDoc(request, "ToDo", todo.name);
		for (const submission of submissions) {
			await deleteDoc(request, "CS17 Assignment Submission", submission);
		}
		await deleteDoc(request, "CS17 Assignment", assignment.name);
		for (const student of students) await deleteTestProfile(request, student.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
		if (sessionProfile) await deleteTestProfile(request, sessionProfile);
	});

	test("lists five assigned submissions and counts all six", async ({ page }) => {
		await page.goto("/dashboard/faculty");

		await expect(page.getByRole("link", { name: "View all (6)" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Grade", exact: true })).toHaveCount(5);
	});
});
