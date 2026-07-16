import * as fs from "fs";
import { test, expect, Page } from "@playwright/test";
import {
	CS17Assignment,
	TEST_ASSIGNMENT_PREFIX,
	cleanupTestAssignments,
	cleanupTestSubmissions,
	createTestAssignment,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { deleteDoc, getList } from "../helpers/frappe";

interface StudentInfo {
	email: string;
	cohort: string;
	cohortName: string;
	profileName: string;
}

const SUBMIT_METHOD =
	"cs17_portal.cs17_portal.doctype.cs17_assignment_submission.cs17_assignment_submission.submit_assignment";

async function submitAsStudent(page: Page, assignment: string, fileUrl: string) {
	await page.goto("/dashboard");
	await page.waitForFunction(
		() =>
			(window as any).csrf_token !== undefined ||
			(window as any).frappe?.csrf_token !== undefined,
		{ timeout: 15000 },
	);
	return page.evaluate(
		async ({ assignment, fileUrl, method }) => {
			const token =
				(window as any).csrf_token ?? (window as any).frappe?.csrf_token;
			const resp = await fetch(`/api/method/${method}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Frappe-CSRF-Token": token,
				},
				body: JSON.stringify({ assignment, file_url: fileUrl }),
			});
			return { ok: resp.ok, status: resp.status };
		},
		{ assignment, fileUrl, method: SUBMIT_METHOD },
	);
}

async function saveProjectAsStudent(page: Page, project: string) {
	await page.waitForFunction(
		() =>
			(window as any).csrf_token !== undefined ||
			(window as any).frappe?.csrf_token !== undefined,
		{ timeout: 15000 },
	);
	return page.evaluate(
		async ({ project }) => {
			const token =
				(window as any).csrf_token ?? (window as any).frappe?.csrf_token;
			const resp = await fetch("/api/method/cs17_portal.api.save_project", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Frappe-CSRF-Token": token,
				},
				body: JSON.stringify({
					project,
					filename: "project.sb3",
					content: btoa("PKtest"),
				}),
			});
			return { ok: resp.ok, status: resp.status };
		},
		{ project },
	);
}

async function submitScratchAsStudent(page: Page, assignment: string, title: string) {
	await page.goto("/dashboard");
	await page.waitForFunction(
		() =>
			(window as any).csrf_token !== undefined ||
			(window as any).frappe?.csrf_token !== undefined,
		{ timeout: 15000 },
	);
	return page.evaluate(
		async ({ assignment, title }) => {
			const token =
				(window as any).csrf_token ?? (window as any).frappe?.csrf_token;
			const call = async (method: string, body: unknown) => {
				const resp = await fetch(`/api/method/${method}`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"X-Frappe-CSRF-Token": token,
					},
					body: JSON.stringify(body),
				});
				return resp.json();
			};
			const project = (
				await call("cs17_portal.api.create_project", { project_title: title })
			).message.name;
			await call("cs17_portal.api.save_project", {
				project,
				filename: "p.sb3",
				content: btoa("PKtest"),
			});
			await call("cs17_portal.api.submit_scratch_project", { assignment, project });
			return project as string;
		},
		{ assignment, title },
	);
}

test.describe("Student submission types", () => {
	let pdf: CS17Assignment;
	let url: CS17Assignment;
	let anyType: CS17Assignment;
	let uiPdf: CS17Assignment;
	let uiUrl: CS17Assignment;
	let scratch: CS17Assignment;

	test.beforeAll(async ({ request }) => {
		const studentInfo: StudentInfo = JSON.parse(
			fs.readFileSync("e2e/.auth/student-info.json", "utf-8"),
		);
		await ensureSessionFaculty(request);
		const cohort = studentInfo.cohort;
		pdf = await createTestAssignment(request, { cohort, submissionType: "PDF" });
		url = await createTestAssignment(request, { cohort, submissionType: "URL" });
		anyType = await createTestAssignment(request, { cohort, submissionType: "Any" });
		uiPdf = await createTestAssignment(request, {
			cohort,
			submissionType: "PDF",
			title: `E2E Assignment UI-PDF ${Date.now()}`,
		});
		uiUrl = await createTestAssignment(request, {
			cohort,
			submissionType: "URL",
			title: `E2E Assignment UI-URL ${Date.now()}`,
		});
		scratch = await createTestAssignment(request, {
			cohort,
			submissionType: "Scratch",
			title: `E2E Assignment Scratch ${Date.now()}`,
		});
	});

	test.afterAll(async ({ request }) => {
		// Cohort and student belong to the student-setup project; leave them.
		await cleanupTestSubmissions(request);
		await cleanupTestAssignments(request);
		const projects = await getList<{ name: string }>(request, "CS17 Project", {
			fields: ["name"],
			filters: { project_title: ["like", `${TEST_ASSIGNMENT_PREFIX}%`] },
			limit: 200,
		});
		for (const project of projects) {
			await deleteDoc(request, "CS17 Project", project.name);
		}
	});

	test("rejects a non-PDF and accepts a PDF for a PDF assignment", async ({ page }) => {
		const bad = await submitAsStudent(page, pdf.name, "/files/report.png");
		expect(bad.ok).toBeFalsy();

		const good = await submitAsStudent(page, pdf.name, "/files/report.pdf");
		expect(good.ok).toBeTruthy();
	});

	test("stores a URL submission in submission_url, not submission_document", async ({
		page,
		request,
	}) => {
		const link = "https://github.com/student/work";
		const result = await submitAsStudent(page, url.name, link);
		expect(result.ok).toBeTruthy();

		const subs = await getList<{
			name: string;
			submission_document?: string;
			submission_url?: string;
		}>(request, "CS17 Assignment Submission", {
			fields: ["name", "submission_document", "submission_url"],
			filters: { assignment: url.name },
			limit: 1,
		});
		expect(subs[0].submission_url).toBe(link);
		expect(subs[0].submission_document).toBeFalsy();
	});

	test("rejects a non-URL value for a URL assignment", async ({ page }) => {
		const bad = await submitAsStudent(page, url.name, "/files/work.pdf");
		expect(bad.ok).toBeFalsy();
	});

	test("accepts any file for an Any assignment", async ({ page, request }) => {
		const result = await submitAsStudent(page, anyType.name, "/files/notes.txt");
		expect(result.ok).toBeTruthy();

		const subs = await getList<{ name: string; submission_document?: string }>(
			request,
			"CS17 Assignment Submission",
			{
				fields: ["name", "submission_document"],
				filters: { assignment: anyType.name },
				limit: 1,
			},
		);
		expect(subs[0].submission_document).toBe("/files/notes.txt");
	});

	test("scratch submit: auto-project, confirm + success dialogs, then dashboard", async ({
		page,
	}) => {
		await page.goto("/dashboard/assignments");
		const row = page.locator("tr", { hasText: scratch.title });
		await row.getByRole("button", { name: "Submit" }).click();

		// A project was created automatically and the student landed in the editor.
		await page.waitForURL(
			(url) =>
				url.pathname.includes("/projects/") &&
				url.pathname.endsWith("/edit") &&
				url.searchParams.get("assignment") === scratch.name,
		);

		// The auto-created project is empty; save it so the snapshot submit succeeds.
		const projectId = page.url().match(/\/projects\/([^/]+)\/edit/)![1];
		const saved = await saveProjectAsStudent(page, projectId);
		expect(saved.ok).toBeTruthy();

		// Submit opens a confirmation preselected to that assignment.
		await page.getByRole("button", { name: "Submit", exact: true }).click();
		const dialog = page.getByRole("dialog");
		await expect(dialog.getByText("Submit this project?")).toBeVisible();
		await expect(dialog.getByText(scratch.title)).toBeVisible();

		// Confirm → success dialog → go to dashboard.
		await dialog.getByRole("button", { name: "Submit", exact: true }).click();
		await expect(dialog.getByText("Submission successful")).toBeVisible();
		await dialog.getByRole("button", { name: "Go to Dashboard" }).click();
		await page.waitForURL(
			(url) => url.pathname === "/dashboard" || url.pathname === "/dashboard/",
		);
	});

	test("previewing a submitted scratch assignment opens its project in the editor", async ({
		page,
	}) => {
		const project = await submitScratchAsStudent(page, scratch.name, scratch.title);

		// Preview must work from the dashboard's assignment table too, not only the
		// full assignments page (the dashboard fetch was missing the project link).
		await page.goto("/dashboard");
		const row = page.locator("tr", { hasText: scratch.title });
		await row.getByRole("button", { name: "Preview" }).click();

		await page.waitForURL(
			(url) => url.pathname === `/dashboard/projects/${project}/edit`,
		);
		await expect(page.getByTitle("Scratch editor")).toBeVisible();
	});

	test("submit dialog adapts to the assignment type", async ({ page }) => {
		await page.goto("/dashboard/assignments");

		const pdfRow = page.locator("tr", { hasText: uiPdf.title });
		await pdfRow.getByRole("button", { name: "Submit" }).click();
		await expect(page.getByText("Upload a PDF only")).toBeVisible();
		await expect(page.locator('input[type="file"]')).toHaveAttribute(
			"accept",
			"application/pdf",
		);
		await page.keyboard.press("Escape");

		const urlRow = page.locator("tr", { hasText: uiUrl.title });
		await urlRow.getByRole("button", { name: "Submit" }).click();
		await expect(page.getByText("Paste a URL only")).toBeVisible();
		await expect(page.locator('input[type="url"]')).toBeVisible();
	});
});
