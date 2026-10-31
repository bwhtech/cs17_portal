import * as fs from "fs";
import { Page, expect, test } from "@playwright/test";
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
import { callAsStudent } from "../helpers/student";

const EVEN_NUMBERS = "for number in range(1, 11):\n    if number % 2 == 0:\n        print(number)";

let cohort: string;

async function pasteIntoEditor(page: Page, text: string) {
	await page.locator(".cm-content").evaluate((editor, text) => {
		const clipboardData = new DataTransfer();
		clipboardData.setData("text/plain", text);
		editor.dispatchEvent(
			new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true })
		);
	}, text);
}

test.describe("Python paste log", () => {
	const faculties: TestFaculty[] = [];

	test.beforeAll(async ({ request }) => {
		cohort = JSON.parse(fs.readFileSync("e2e/.auth/student-info.json", "utf-8")).cohort;
		await ensureSessionFaculty(request);
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestSubmissions(request, cohort);
		const projects = await getList<{ name: string }>(request, "CS17 Project", {
			fields: ["name"],
			filters: {
				project_title: ["like", `${TEST_ASSIGNMENT_PREFIX}%`],
				profile: ["like", `%-${cohort}-%`],
			},
			limit: 200,
		});
		for (const project of projects) {
			try {
				await deleteDoc(request, "CS17 Project", project.name);
			} catch (error) {
				console.warn(`Failed to delete project ${project.name}:`, error);
			}
		}
		const pastes = await getList<{ name: string }>(request, "CS17 Paste", {
			fields: ["name"],
			filters: { assignment: ["like", `%-${cohort}-%`] },
			limit: 200,
		});
		for (const paste of pastes) {
			try {
				await deleteDoc(request, "CS17 Paste", paste.name);
			} catch (error) {
				console.warn(`Failed to delete paste ${paste.name}:`, error);
			}
		}
		await cleanupTestAssignments(request, cohort);
		for (const faculty of faculties) {
			try {
				await deleteTestProfile(request, faculty.profileName);
				await deleteTestUser(request, faculty.email);
			} catch (error) {
				console.warn(`Failed to delete faculty ${faculty.email}:`, error);
			}
		}
	});

	test("shows faculty the code a student pasted", async ({ browser, page, request }) => {
		const assignment = await createDoc<CS17Assignment>(request, "CS17 Assignment", {
			title: `${TEST_ASSIGNMENT_PREFIX} Paste ${Date.now()}`,
			cohort,
			submission_type: "Python",
			assignment_type: "Graded",
			remarks: "Marks",
			max_marks: 10,
			due_date: "2030-01-01 00:00:00",
			is_published: 1,
			watch_tab_switches: 1,
		});
		await page.goto("/dashboard");
		const started = await callAsStudent(page, "cs17_portal.api.start_python_assignment", {
			assignment: assignment.name,
		});
		const project = started.body.message.name;
		await page.goto(`/dashboard/projects/${project}/code?assignment=${assignment.name}`);
		await expect(
			page.getByText("Your teacher can see when you leave this tab or paste code.")
		).toBeVisible();

		await pasteIntoEditor(page, "print(1)");
		const recorded = page.waitForResponse(/record_paste/);
		await pasteIntoEditor(page, EVEN_NUMBERS);
		await recorded;
		await expect(page.getByText("You pasted code. Your teacher can see this.")).toBeVisible();

		await callAsStudent(page, "cs17_portal.api.save_python_project", {
			project,
			code: EVEN_NUMBERS,
		});
		const submitted = await callAsStudent(page, "cs17_portal.api.submit_python_project", {
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
		await facultyPage.goto(`/dashboard/faculty/submissions/${submitted.body.message.name}`);

		await expect(facultyPage.getByText("Pasted code 1 time")).toBeVisible({ timeout: 60000 });
		await facultyPage.locator("summary", { hasText: "3 lines" }).click();
		await expect(facultyPage.locator("details pre")).toHaveText(EVEN_NUMBERS);
		await context.close();
	});
});
