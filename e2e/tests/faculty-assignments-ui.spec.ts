import * as fs from "fs";
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
import { deleteDoc, updateDoc, uploadFile } from "../helpers/frappe";

const DRAFT_KEY = "cs17-new-assignment-draft";

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

	test("offers Scratch as a submission type and saves it", async ({ page }) => {
		const title = `${TEST_ASSIGNMENT_PREFIX} Scratch ${Date.now()}`;
		await page.goto("/dashboard/faculty/assignments");
		await page.getByRole("button", { name: "New Assignment" }).click();

		await page.getByPlaceholder("Assignment title").fill(title);
		await page.getByRole("combobox").filter({ hasText: "Select a cohort" }).click();
		await page.getByRole("listbox").waitFor();
		await page.keyboard.type(cohort.name);
		await page.keyboard.press("Enter");
		await page.locator('input[type="datetime-local"]').fill("2030-03-03T09:00");

		await page.getByRole("combobox").filter({ hasText: "Any" }).click();
		await page.getByRole("option", { name: "Scratch", exact: true }).click();

		await page.getByRole("combobox").filter({ hasText: "Save as Draft" }).click();
		await page.getByRole("option", { name: "Publish Now" }).click();
		await page.getByRole("button", { name: "Create Assignment" }).click();

		const row = page.locator("tr", { hasText: title });
		await expect(row).toBeVisible();
		await expect(row.getByText("Scratch", { exact: true })).toBeVisible();
	});

	test("keeps a closed draft in localStorage and restores it on reopen", async ({ page }) => {
		const title = `${TEST_ASSIGNMENT_PREFIX} Draft ${Date.now()}`;
		await page.goto("/dashboard/faculty/assignments");
		await page.evaluate((key) => localStorage.removeItem(key), DRAFT_KEY);

		await page.getByRole("button", { name: "New Assignment" }).click();
		await page.getByPlaceholder("Assignment title").fill(title);
		await page.getByPlaceholder(/What should students do/).fill("Draft body text");

		await page.keyboard.press("Escape");
		await expect(page.getByPlaceholder("Assignment title")).toBeHidden();

		const stored = await page.evaluate(
			(key) => JSON.parse(localStorage.getItem(key) || "null"),
			DRAFT_KEY,
		);
		expect(stored?.draft?.title).toBe(title);
		expect(stored?.draft?.description).toBe("Draft body text");

		await page.getByRole("button", { name: "New Assignment" }).click();
		await expect(page.getByPlaceholder("Assignment title")).toHaveValue(title);
		await expect(page.getByPlaceholder(/What should students do/)).toHaveValue(
			"Draft body text",
		);

		await page.evaluate((key) => localStorage.removeItem(key), DRAFT_KEY);
	});

	test("clears the localStorage draft after a successful create", async ({ page }) => {
		const title = `${TEST_ASSIGNMENT_PREFIX} ClearDraft ${Date.now()}`;
		await page.goto("/dashboard/faculty/assignments");
		await page.getByRole("button", { name: "New Assignment" }).click();

		await page.getByPlaceholder("Assignment title").fill(title);
		await page.getByRole("combobox").filter({ hasText: "Select a cohort" }).click();
		await page.getByRole("listbox").waitFor();
		await page.keyboard.type(cohort.name);
		await page.keyboard.press("Enter");
		await page.locator('input[type="datetime-local"]').fill("2030-02-02T09:00");
		await page.getByRole("combobox").filter({ hasText: "Save as Draft" }).click();
		await page.getByRole("option", { name: "Publish Now" }).click();
		await page.getByRole("button", { name: "Create Assignment" }).click();

		await expect(page.locator("tr", { hasText: title })).toBeVisible();
		const stored = await page.evaluate(
			(key) => localStorage.getItem(key),
			DRAFT_KEY,
		);
		expect(stored).toBeNull();
	});

	test("previews a Scratch submission in the read-only editor", async ({
		page,
		request,
	}) => {
		const scratch = await createTestAssignment(request, {
			cohort: cohort.name,
			submissionType: "Scratch",
		});
		const submission = await createTestSubmission(request, {
			assignment: scratch.name,
			student: student.name,
		});
		const uploaded = await uploadFile(request, {
			fileName: "project.sb3",
			content: fs.readFileSync(
				"cs17_portal/public/scratch/sample.sb3",
			),
			doctype: "CS17 Assignment Submission",
			docname: submission.name,
		});
		await updateDoc(request, "CS17 Assignment Submission", submission.name, {
			submission_document: uploaded.file_url,
		});

		await page.goto(`/dashboard/faculty/assignments/${scratch.name}`);
		const row = page.locator("tr", { hasText: student.full_name! });
		await row.getByRole("button", { name: "Preview", exact: true }).click();

		await expect(
			page.getByTitle("Scratch submission player"),
		).toBeVisible();
		await expect(page.getByRole("button", { name: "Open file" })).toHaveCount(0);

		const frame = page
			.frames()
			.find((f) => f.url().includes("scratch/editor.html"))!;
		await expect
			.poll(() =>
				frame.evaluate(
					() => !!document.getElementById("cs17-readonly-style"),
				),
			)
			.toBe(true);
		const state = await frame.evaluate(() => {
			const hidden = (sel: string) => {
				const el = document.querySelector(sel) as HTMLElement | null;
				return !el || getComputedStyle(el).display === "none";
			};
			const pe = (sel: string) => {
				const el = document.querySelector(sel);
				return el ? getComputedStyle(el).pointerEvents : "missing";
			};
			return {
				menuBarHidden: hidden('[class*="menu-bar_menu-bar_"]'),
				tabsHidden: hidden('[class*="gui_tab-list_"]'),
				spritePaneHidden: hidden('[class*="target-pane_target-pane_"]'),
				findHidden: hidden(".sa-find-bar"),
				paletteHidden: hidden(".blocklyToolboxDiv"),
				scrollbarHidden: hidden(".blocklyScrollbarVertical"),
				blockCanvas: pe(".blocklyBlockCanvas"),
				greenFlag: pe('[class*="green-flag_green-flag_"]'),
			};
		});
		expect(state.menuBarHidden).toBe(true);
		expect(state.tabsHidden).toBe(true);
		expect(state.spritePaneHidden).toBe(true);
		expect(state.findHidden).toBe(true);
		expect(state.paletteHidden).toBe(true);
		expect(state.scrollbarHidden).toBe(true);
		expect(state.blockCanvas).toBe("none");
		expect(state.greenFlag).not.toBe("none");
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
