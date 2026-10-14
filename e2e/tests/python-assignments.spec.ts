import * as fs from "fs";
import { APIRequestContext, Page, expect, test } from "@playwright/test";
import {
	CS17Assignment,
	TEST_ASSIGNMENT_PREFIX,
	TestFaculty,
	cleanupTestAssignments,
	cleanupTestSubmissions,
	createTestFaculty,
	deleteTestProfile,
	deleteTestUser,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { createDoc, deleteDoc, getList } from "../helpers/frappe";

const STARTER_CODE = "name = input()";
const CORRECT_PROGRAM = 'name = input()\nprint(f"Hello, {name}!")';

let cohort: string;

function createPythonAssignment(
	request: APIRequestContext,
	watchTabSwitches = 0
): Promise<CS17Assignment> {
	return createDoc<CS17Assignment>(request, "CS17 Assignment", {
		title: `${TEST_ASSIGNMENT_PREFIX} Python ${Date.now()}`,
		cohort,
		submission_type: "Python",
		assignment_type: "Graded",
		remarks: "Marks",
		max_marks: 10,
		due_date: "2030-01-01 00:00:00",
		is_published: 1,
		watch_tab_switches: watchTabSwitches,
		starter_code: STARTER_CODE,
		test_cases: [
			{ input: "Asha\n", expected_output: "Hello, Asha!\n", is_hidden: 0 },
			{ input: "Ravi\n", expected_output: "Hello, Ravi!\n", is_hidden: 1 },
		],
	});
}

async function callAsStudent(page: Page, method: string, body: unknown) {
	await page.waitForFunction(
		() =>
			(window as any).csrf_token !== undefined ||
			(window as any).frappe?.csrf_token !== undefined,
		{ timeout: 15000 }
	);
	return page.evaluate(
		async ({ method, body }) => {
			const token = (window as any).csrf_token ?? (window as any).frappe?.csrf_token;
			const resp = await fetch(`/api/method/${method}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Frappe-CSRF-Token": token,
				},
				body: JSON.stringify(body),
			});
			return (await resp.json()).message;
		},
		{ method, body }
	);
}

async function openEditor(page: Page, assignment: string): Promise<string> {
	await page.goto("/dashboard");
	const project = await callAsStudent(page, "cs17_portal.api.start_python_assignment", {
		assignment,
	});
	await page.goto(`/dashboard/projects/${project.name}/code?assignment=${assignment}`);
	await expect(page.locator(".cm-content")).toHaveText(STARTER_CODE);
	return project.name;
}

test.describe("Python assignments", () => {
	const faculties: TestFaculty[] = [];

	test.beforeAll(async ({ request }) => {
		cohort = JSON.parse(fs.readFileSync("e2e/.auth/student-info.json", "utf-8")).cohort;
		await ensureSessionFaculty(request);
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestSubmissions(request);
		const projects = await getList<{ name: string }>(request, "CS17 Project", {
			fields: ["name"],
			filters: { project_title: ["like", `${TEST_ASSIGNMENT_PREFIX}%`] },
			limit: 200,
		});
		for (const project of projects) {
			await deleteDoc(request, "CS17 Project", project.name);
		}
		const leaves = await getList<{ name: string }>(request, "CS17 Tab Leave", {
			fields: ["name"],
			filters: { assignment: ["like", `%-${cohort}-%`] },
			limit: 200,
		});
		for (const leave of leaves) {
			await deleteDoc(request, "CS17 Tab Leave", leave.name);
		}
		await cleanupTestAssignments(request);
		for (const faculty of faculties) {
			try {
				await deleteTestProfile(request, faculty.profileName);
				await deleteTestUser(request, faculty.email);
			} catch (error) {
				console.warn(`Failed to delete faculty ${faculty.email}:`, error);
			}
		}
	});

	test("shows the starter code and examples, never the hidden test", async ({
		page,
		request,
	}) => {
		const assignment = await createPythonAssignment(request);
		const details = page.waitForResponse(/get_student_assignment/);

		await page.goto(`/dashboard/assignments/${assignment.name}/submission`);
		expect(await (await details).text()).not.toContain("Ravi");
		await page.getByRole("button", { name: "Submit Assignment" }).click();

		await expect(page).toHaveURL(/\/dashboard\/projects\/PROJ-.+\/code\?assignment=/);
		await expect(page.locator(".cm-content")).toHaveText(STARTER_CODE);
		await expect(page.getByText("Example 1")).toBeVisible();
		await expect(
			page.getByText("Your teacher also checks 1 hidden test after you submit.")
		).toBeVisible();
		await expect(page.getByText("Ravi")).toHaveCount(0);
	});

	test("passes the example test with a correct program", async ({ page, request }) => {
		const assignment = await createPythonAssignment(request);
		await openEditor(page, assignment.name);

		await page.locator(".cm-content").fill(CORRECT_PROGRAM);
		await page.getByRole("button", { name: "Run tests" }).click();

		await expect(page.getByRole("tabpanel", { name: "Tests" })).toContainText(
			"1 of 1 test passed",
			{ timeout: 60000 }
		);
	});

	test("submits a copy of the program", async ({ page, request }) => {
		const assignment = await createPythonAssignment(request);
		await openEditor(page, assignment.name);

		await page.locator(".cm-content").fill(CORRECT_PROGRAM);
		await page.getByRole("button", { name: "Submit", exact: true }).click();
		const dialog = page.getByRole("dialog");
		await expect(dialog.getByText("Submit this project?")).toBeVisible();
		await dialog.getByRole("button", { name: "Submit", exact: true }).click();
		await expect(dialog.getByText("Your project was submitted to")).toBeVisible();

		const submissions = await getList<{ code: string | null }>(
			request,
			"CS17 Assignment Submission",
			{
				fields: ["code"],
				filters: { assignment: assignment.name },
				limit: 1,
			}
		);
		expect(submissions[0]?.code).toBe(CORRECT_PROGRAM);
	});

	test("grades against every test and prefills the marks", async ({
		browser,
		page,
		request,
	}) => {
		const assignment = await createPythonAssignment(request);
		const project = await openEditor(page, assignment.name);
		await callAsStudent(page, "cs17_portal.api.save_python_project", {
			project,
			code: CORRECT_PROGRAM,
		});
		const submission = await callAsStudent(page, "cs17_portal.api.submit_python_project", {
			assignment: assignment.name,
			project,
		});

		const faculty = await createTestFaculty(request);
		faculties.push(faculty);
		const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
		await context.request.post("/api/method/login", {
			form: { usr: faculty.email, pwd: faculty.password },
		});
		const facultyPage = await context.newPage();
		await facultyPage.goto(`/dashboard/faculty/submissions/${submission.name}`);

		await expect(facultyPage.getByText("2 of 2 tests passed")).toBeVisible({ timeout: 60000 });
		await expect(facultyPage.getByLabel("Marks obtained")).toHaveValue("10");
		await context.close();
	});

	test("warns a student who leaves the tab on a watched assignment", async ({
		page,
		request,
	}) => {
		const assignment = await createPythonAssignment(request, 1);
		await openEditor(page, assignment.name);
		await expect(
			page.getByText("Your teacher can see when you leave this tab.")
		).toBeVisible();

		await page.evaluate(() => {
			for (const state of ["hidden", "visible"]) {
				Object.defineProperty(document, "visibilityState", {
					configurable: true,
					get: () => state,
				});
				document.dispatchEvent(new Event("visibilitychange"));
			}
		});

		await expect(
			page.getByText("You left this tab. Your teacher can see this.")
		).toBeVisible();
	});

	test("shows faculty how often the student left the tab", async ({
		browser,
		page,
		request,
	}) => {
		const assignment = await createPythonAssignment(request, 1);
		const project = await openEditor(page, assignment.name);
		await callAsStudent(page, "cs17_portal.api.record_tab_leave", { project });
		await callAsStudent(page, "cs17_portal.api.record_tab_return", { project });
		await callAsStudent(page, "cs17_portal.api.save_python_project", {
			project,
			code: CORRECT_PROGRAM,
		});
		const submission = await callAsStudent(page, "cs17_portal.api.submit_python_project", {
			assignment: assignment.name,
			project,
		});

		const faculty = await createTestFaculty(request);
		faculties.push(faculty);
		const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
		await context.request.post("/api/method/login", {
			form: { usr: faculty.email, pwd: faculty.password },
		});
		const facultyPage = await context.newPage();
		await facultyPage.goto(`/dashboard/faculty/submissions/${submission.name}`);

		await expect(facultyPage.getByText("Left the tab 1 time")).toBeVisible({ timeout: 60000 });
		await context.close();
	});
});
