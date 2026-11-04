import * as fs from "fs";
import { test, expect } from "@playwright/test";
import {
	CS17Assignment,
	CS17Submission,
	createTestAssignment,
	createTestSubmission,
} from "../helpers/cs17";
import { deleteDoc, updateDoc } from "../helpers/frappe";

test.describe("Late work for a student", () => {
	let student: string;
	let cohort: string;
	let assignment: CS17Assignment;
	let submission: CS17Submission | undefined;

	test.beforeAll(() => {
		({ profileName: student, cohort } = JSON.parse(
			fs.readFileSync("e2e/.auth/student-info.json", "utf-8")
		));
	});

	test.beforeEach(async ({ request }) => {
		assignment = await createTestAssignment(request, { cohort });
		await updateDoc(request, "CS17 Assignment", assignment.name, {
			due_date: "2025-12-31 00:00:00",
			late_until: "2030-01-01 00:00:00",
			late_penalty: 10,
		});
	});

	test.afterEach(async ({ request }) => {
		if (submission) await deleteDoc(request, "CS17 Assignment Submission", submission.name);
		submission = undefined;
		await deleteDoc(request, "CS17 Assignment", assignment.name);
	});

	test("says late work is still accepted after the due date", async ({ page }) => {
		await page.goto(`/dashboard/assignments/${assignment.name}/submission`);

		await expect(page.getByText(/Late work accepted until/)).toContainText("10% off");
		await expect(page.getByRole("button", { name: "Submit Assignment" })).toBeVisible();
	});

	test("keeps work in its late window on the dashboard", async ({ page }) => {
		await page.goto("/dashboard");

		await expect(
			page.locator('[data-slot="list-row"]').filter({ hasText: assignment.title })
		).toBeVisible();
	});

	test("shows a submission made after the due date as late", async ({ page, request }) => {
		submission = await createTestSubmission(request, { assignment: assignment.name, student });

		await page.goto(`/dashboard/assignments/${assignment.name}/submission`);

		await expect(page.getByText("Submitted late", { exact: true })).toBeVisible();
	});
});
