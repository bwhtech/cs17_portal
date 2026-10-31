import * as fs from "fs";
import { test, expect } from "@playwright/test";
import {
	CS17Cohort,
	CS17Profile,
	cleanupTestAssignments,
	cleanupTestGrades,
	cleanupTestSubmissions,
	createTestAssignment,
	createTestCohort,
	createTestProfile,
	createTestSubmission,
	deleteTestProfile,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { deleteDoc, getList } from "../helpers/frappe";

const REMARK = "Check the 0 case";

let cohort: CS17Cohort;
let student: CS17Profile;

test.describe("Saved remarks", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		student = await createTestProfile(request, {
			profileType: "Student",
			cohort: cohort.name,
		});
	});

	test.afterAll(async ({ request }) => {
		const faculty = JSON.parse(fs.readFileSync("e2e/.auth/faculty-info.json", "utf-8"));
		const saved = await getList<{ name: string }>(request, "CS17 Saved Remark", {
			filters: { owner: faculty.email },
		});
		for (const { name } of saved) await deleteDoc(request, "CS17 Saved Remark", name);
		await cleanupTestGrades(request, cohort.name);
		await cleanupTestSubmissions(request, cohort.name);
		await cleanupTestAssignments(request, cohort.name);
		await deleteTestProfile(request, student.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("saves the remarks, adds them back and deletes them", async ({ page, request }) => {
		const assignment = await createTestAssignment(request, {
			cohort: cohort.name,
			assignmentType: "Graded",
		});
		const submission = await createTestSubmission(request, {
			assignment: assignment.name,
			student: student.name,
		});
		const remarks = page.getByLabel("Remarks", { exact: true });
		const savedRemarks = page.getByRole("button", { name: "Saved remarks" });

		await page.goto(`/dashboard/faculty/submissions/${submission.name}`);
		await remarks.fill(REMARK);
		await savedRemarks.click();
		await page.getByRole("menuitem", { name: "Save current remarks" }).click();
		await expect(page.getByText("Remark saved")).toBeVisible();

		await remarks.fill("Good start.");
		await savedRemarks.click();
		await page.getByRole("menuitem", { name: REMARK }).click();
		await expect(remarks).toHaveValue(`Good start.\n${REMARK}`);

		await savedRemarks.click();
		await page.getByRole("menuitem", { name: "Delete a saved remark" }).click();
		await page
			.getByRole("menu", { name: "Delete a saved remark" })
			.getByRole("menuitem", { name: REMARK })
			.click();
		await expect(page.getByText("Remark deleted")).toBeVisible();
	});
});
