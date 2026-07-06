import { test, expect } from "@playwright/test";
import {
	CS17Assignment,
	CS17Cohort,
	CS17Profile,
	TEST_ASSIGNMENT_PREFIX,
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
import { deleteDoc, getDoc, getList } from "../helpers/frappe";

let cohort: CS17Cohort;
let student: CS17Profile;
let graded: CS17Assignment;

test.describe("Faculty assignment portal", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		student = await createTestProfile(request, {
			profileType: "Student",
			cohort: cohort.name,
		});
		graded = await createTestAssignment(request, {
			cohort: cohort.name,
			assignmentType: "Graded",
		});
		await createTestSubmission(request, {
			assignment: graded.name,
			student: student.name,
		});
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestGrades(request);
		await cleanupTestSubmissions(request);
		await cleanupTestAssignments(request);
		await deleteTestProfile(request, student.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("creates and publishes an assignment from the sheet", async ({ page }) => {
		const title = `${TEST_ASSIGNMENT_PREFIX} UI ${Date.now()}`;
		await page.goto("/dashboard/faculty/assignments");
		await page.getByRole("button", { name: "New Assignment" }).click();

		await page.getByPlaceholder("Assignment title").fill(title);
		await page.getByRole("combobox").filter({ hasText: "Select a cohort" }).click();
		await page.getByRole("listbox").waitFor();
		await page.keyboard.type(cohort.name);
		await page.keyboard.press("Enter");
		await page.locator('input[type="datetime-local"]').fill("2030-01-01T09:00");
		await page.getByRole("combobox").filter({ hasText: "Save as Draft" }).click();
		await page.getByRole("option", { name: "Publish Now" }).click();

		await page.getByRole("button", { name: "Create Assignment" }).click();

		const row = page.locator("tr", { hasText: title });
		await expect(row).toBeVisible();
		await expect(row.getByText("Published")).toBeVisible();
	});

	test("auto-saves every filled field as a draft on close", async ({ page, request }) => {
		const title = `${TEST_ASSIGNMENT_PREFIX} Autosave ${Date.now()}`;
		await page.goto("/dashboard/faculty/assignments");
		await page.getByRole("button", { name: "New Assignment" }).click();

		await page.getByPlaceholder("Assignment title").fill(title);
		await page.locator('input[type="datetime-local"]').fill("2030-03-03T10:00");
		await page.getByPlaceholder(/What should students do/).fill("Draft body text");

		await page.keyboard.press("Escape");
		await page.waitForResponse(
			(r) => r.url().includes("create_assignment") && r.status() === 200,
		);

		const rows = await getList<{ name: string }>(request, "CS17 Assignment", {
			fields: ["name"],
			filters: { title },
			limit: 1,
		});
		expect(rows.length).toBe(1);
		const doc = await getDoc<{ due_date: string; description: string }>(
			request,
			"CS17 Assignment",
			rows[0].name,
		);
		expect(doc.due_date).toContain("2030-03-03");
		expect(doc.description).toContain("Draft body text");

		await page.getByRole("button", { name: /Drafts \(/ }).click();
		await page.getByRole("button", { name: title }).first().click();
		await expect(page.getByPlaceholder(/What should students do/)).toHaveValue(
			"Draft body text",
		);
	});

	test("grades a submission and publishes the grade", async ({ page }) => {
		await page.goto("/dashboard/faculty/assignments");
		await page.getByRole("button", { name: graded.title, exact: true }).click();

		await expect(page.getByRole("heading", { name: graded.title })).toBeVisible();

		const row = page.locator("tr", { hasText: student.full_name! });
		await row.getByRole("button", { name: "Grade", exact: true }).click();

		await page.getByRole("combobox").filter({ hasText: "Select a grade" }).click();
		await page.getByRole("option", { name: "A", exact: true }).click();
		await page.getByRole("combobox").filter({ hasText: "Save as Draft" }).click();
		await page.getByRole("option", { name: "Publish Now" }).click();
		await page.getByRole("button", { name: "Save Grade" }).click();

		await expect(row.getByText("Published")).toBeVisible();
		await expect(row.getByText("A", { exact: true })).toBeVisible();
	});
});
