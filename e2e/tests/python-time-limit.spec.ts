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
import { createDoc, deleteDoc, getList, updateDoc } from "../helpers/frappe";

const STARTER_CODE = "name = input()";
const QUESTION = "Print a greeting for the name you read.";

let cohort: string;

function createTimedAssignment(
	request: APIRequestContext,
	timeLimit = 30,
	attemptsAllowed = 0
): Promise<CS17Assignment> {
	return createDoc<CS17Assignment>(request, "CS17 Assignment", {
		title: `${TEST_ASSIGNMENT_PREFIX} Timed ${Date.now()}`,
		cohort,
		submission_type: "Python",
		assignment_type: "Graded",
		remarks: "Marks",
		max_marks: 10,
		due_date: "2030-01-01 00:00:00",
		is_published: 1,
		description: QUESTION,
		starter_code: STARTER_CODE,
		time_limit: timeLimit,
		attempts_allowed: attemptsAllowed,
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

function secondsEarlier(datetime: string, seconds: number): string {
	const shifted = new Date(
		Date.parse(`${datetime.slice(0, 19).replace(" ", "T")}Z`) - seconds * 1000
	);
	return shifted.toISOString().slice(0, 19).replace("T", " ");
}

test.describe("Python assignment time limit", () => {
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
		const attempts = await getList<{ name: string }>(request, "CS17 Assignment Attempt", {
			fields: ["name"],
			filters: { assignment: ["like", `%-${cohort}-%`] },
			limit: 200,
		});
		for (const attempt of attempts) {
			await deleteDoc(request, "CS17 Assignment Attempt", attempt.name);
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

	test("asks before starting the clock and shows the question after", async ({
		page,
		request,
	}) => {
		const assignment = await createTimedAssignment(request);

		await page.goto(`/dashboard/assignments/${assignment.name}/submission`);
		await expect(page.getByText("You will see the question when you start.")).toBeVisible();
		await page.getByRole("button", { name: "Submit Assignment" }).click();
		const dialog = page.getByRole("dialog");
		await expect(dialog.getByText("You will have 30 minutes.")).toBeVisible();
		await dialog.getByRole("button", { name: "Start", exact: true }).click();

		await expect(page).toHaveURL(/\/dashboard\/projects\/PROJ-.+\/code\?assignment=/);
		await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();
		await expect(page.getByText(QUESTION)).toBeVisible();
	});

	test("submits the code when time is up", async ({ page, request }) => {
		const assignment = await createTimedAssignment(request, 1);
		await page.goto("/dashboard");
		const project = await callAsStudent(page, "cs17_portal.api.start_python_assignment", {
			assignment: assignment.name,
		});
		const [attempt] = await getList<{ name: string; started_at: string }>(
			request,
			"CS17 Assignment Attempt",
			{ fields: ["name", "started_at"], filters: { assignment: assignment.name }, limit: 1 }
		);
		await updateDoc(request, "CS17 Assignment Attempt", attempt.name, {
			started_at: secondsEarlier(attempt.started_at, 45),
		});

		await page.goto(`/dashboard/projects/${project.name}/code?assignment=${assignment.name}`);
		await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();
		await expect(page.getByText("Time is up. Your code was submitted.")).toBeVisible({
			timeout: 30000,
		});

		const submissions = await getList<{ code: string | null }>(
			request,
			"CS17 Assignment Submission",
			{ fields: ["code"], filters: { assignment: assignment.name }, limit: 1 }
		);
		expect(submissions[0]?.code).toBe(STARTER_CODE);
	});

	test("lets a student reattempt once time is up", async ({ page, request }) => {
		const assignment = await createTimedAssignment(request, 30, 2);
		await page.goto("/dashboard");
		await callAsStudent(page, "cs17_portal.api.start_python_assignment", {
			assignment: assignment.name,
		});
		const [attempt] = await getList<{ name: string; started_at: string }>(
			request,
			"CS17 Assignment Attempt",
			{ fields: ["name", "started_at"], filters: { assignment: assignment.name }, limit: 1 }
		);
		await updateDoc(request, "CS17 Assignment Attempt", attempt.name, {
			started_at: secondsEarlier(attempt.started_at, 31 * 60),
		});

		await page.goto(`/dashboard/assignments/${assignment.name}/submission`);
		await page.getByRole("button", { name: "Reattempt" }).click();
		const dialog = page.getByRole("dialog");
		await expect(dialog.getByText("This is attempt 2 of 2.")).toBeVisible();
		await dialog.getByRole("button", { name: "Start", exact: true }).click();

		await expect(page).toHaveURL(/\/dashboard\/projects\/PROJ-.+\/code\?assignment=/);
		await expect(page.getByRole("timer", { name: "Time left" })).toBeVisible();
	});

	test("shows faculty how long the student took", async ({ browser, page, request }) => {
		const assignment = await createTimedAssignment(request);
		await page.goto("/dashboard");
		const project = await callAsStudent(page, "cs17_portal.api.start_python_assignment", {
			assignment: assignment.name,
		});
		const submission = await callAsStudent(page, "cs17_portal.api.submit_python_project", {
			assignment: assignment.name,
			project: project.name,
		});

		const faculty = await createTestFaculty(request);
		faculties.push(faculty);
		const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
		await context.request.post("/api/method/login", {
			form: { usr: faculty.email, pwd: faculty.password },
		});
		const facultyPage = await context.newPage();
		await facultyPage.goto(`/dashboard/faculty/submissions/${submission.name}`);

		await expect(facultyPage.getByText(/took \d+ of 30 min/)).toBeVisible({ timeout: 60000 });
		await context.close();
	});

	test("lets faculty raise the time limit", async ({ browser, request }) => {
		const assignment = await createTimedAssignment(request);
		const faculty = await createTestFaculty(request);
		faculties.push(faculty);
		const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
		await context.request.post("/api/method/login", {
			form: { usr: faculty.email, pwd: faculty.password },
		});
		const facultyPage = await context.newPage();
		await facultyPage.goto(`/dashboard/faculty/assignments/${assignment.name}`);

		await facultyPage.getByRole("button", { name: "Timing", exact: true }).click();
		const dialog = facultyPage.getByRole("dialog");
		await dialog.getByLabel("Time limit (minutes)").fill("45");
		await dialog.getByRole("button", { name: "Save" }).click();

		await expect(facultyPage.getByText("45 minutes")).toBeVisible();
		await context.close();
	});
});
