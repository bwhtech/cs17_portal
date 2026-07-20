import * as fs from "fs";
import { test, expect, Page } from "@playwright/test";
import {
	CS17Assignment,
	TEST_ASSIGNMENT_PREFIX,
	cleanupTestAssignments,
	cleanupTestGrades,
	cleanupTestSubmissions,
	createTestAssignment,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { createDoc, deleteDoc, getList } from "../helpers/frappe";

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

async function createAssignmentProjectAsStudent(
	page: Page,
	assignment: string,
	title: string,
): Promise<string> {
	await page.goto("/dashboard/projects");
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
				await call("cs17_portal.api.create_project", {
					project_title: title,
					assignment,
				})
			).message.name;
			await call("cs17_portal.api.save_project", {
				project,
				filename: "p.sb3",
				content: btoa("PKtest"),
			});
			return project as string;
		},
		{ assignment, title },
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
	let scratchGraded: CS17Assignment;

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
		scratchGraded = await createTestAssignment(request, {
			cohort,
			submissionType: "Scratch",
			assignmentType: "Graded",
			title: `E2E Assignment Scratch Graded ${Date.now()}`,
		});
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestGrades(request);
		await cleanupTestSubmissions(request);
		const projects = await getList<{ name: string }>(request, "CS17 Project", {
			fields: ["name"],
			filters: { project_title: ["like", `${TEST_ASSIGNMENT_PREFIX}%`] },
			limit: 200,
		});
		for (const project of projects) {
			await deleteDoc(request, "CS17 Project", project.name);
		}
		await cleanupTestAssignments(request);
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

		await page.waitForURL(
			(url) =>
				url.pathname.includes("/projects/") &&
				url.pathname.endsWith("/edit") &&
				url.searchParams.get("assignment") === scratch.name,
		);

		const editorDefaults = await page.evaluate(() => ({
			theme: localStorage.getItem("tw:theme"),
			pauseEnabled: JSON.parse(localStorage.getItem("tw:addons") ?? "{}").pause
				?.enabled,
		}));
		expect(editorDefaults.theme).toBe("light");
		expect(editorDefaults.pauseEnabled).toBe(false);

		const projectId = page.url().match(/\/projects\/([^/]+)\/edit/)![1];
		const saved = await saveProjectAsStudent(page, projectId);
		expect(saved.ok).toBeTruthy();

		await page.getByRole("button", { name: "Submit", exact: true }).click();
		const dialog = page.getByRole("dialog");
		await expect(dialog.getByText("Submit this project?")).toBeVisible();
		await expect(dialog.getByText(scratch.title)).toBeVisible();

		await dialog.getByRole("button", { name: "Submit", exact: true }).click();
		await expect(dialog.getByText("Submission successful")).toBeVisible();
		await dialog.getByRole("button", { name: "Go to Dashboard" }).click();
		await page.waitForURL(
			(url) => url.pathname === "/dashboard" || url.pathname === "/dashboard/",
		);
	});

	test("reopening an assignment project submits to it without the picker", async ({
		page,
	}) => {
		const projectId = await createAssignmentProjectAsStudent(
			page,
			scratch.name,
			`${TEST_ASSIGNMENT_PREFIX} Reopen ${Date.now()}`,
		);

		await page.goto(`/dashboard/projects/${projectId}/edit`);
		await page.getByRole("button", { name: "Submit", exact: true }).click();

		const dialog = page.getByRole("dialog");
		await expect(dialog.getByText("Submit this project?")).toBeVisible();
		await expect(dialog.getByText(scratch.title)).toBeVisible();
		await expect(dialog.getByText("Pick a Scratch assignment")).toHaveCount(0);
	});

	test("previewing a submitted scratch assignment opens its project in the editor", async ({
		page,
	}) => {
		const project = await submitScratchAsStudent(page, scratch.name, scratch.title);

		await page.goto("/dashboard");
		const row = page.locator("tr", { hasText: scratch.title });
		await row.getByRole("button", { name: "Preview" }).click();

		await page.waitForURL(
			(url) => url.pathname === `/dashboard/projects/${project}/edit`,
		);
		await expect(page.getByTitle("Scratch editor")).toBeVisible();
	});

	test("cannot rename or delete a project submitted to an assignment", async ({ page }) => {
		const project = await submitScratchAsStudent(page, scratch.name, scratch.title);
		await page.goto("/dashboard/projects");

		const call = (method: string, body: unknown) =>
			page.evaluate(
				async ({ method, body }) => {
					const token =
						(window as any).csrf_token ?? (window as any).frappe?.csrf_token;
					const resp = await fetch(`/api/method/${method}`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"X-Frappe-CSRF-Token": token,
						},
						body: JSON.stringify(body),
					});
					return { ok: resp.ok, body: await resp.json() };
				},
				{ method, body },
			);

		const renamed = await call("cs17_portal.api.rename_project", {
			project,
			project_title: "Sneaky rename",
		});
		expect(renamed.ok).toBe(false);
		expect(renamed.body._server_messages).toContain("cannot be renamed or deleted");

		const deleted = await call("cs17_portal.api.delete_project", { project });
		expect(deleted.ok).toBe(false);
		expect(deleted.body._server_messages).toContain("cannot be renamed or deleted");

		await page.reload();
		const card = page.locator("[data-slot='card']", { hasText: scratch.title }).first();
		await expect(card.getByRole("button", { name: /^Rename / })).toBeDisabled();
		await expect(card.getByRole("button", { name: /^Delete / })).toBeDisabled();

		const reason = card.locator("span[title]").first();
		await expect(reason).toHaveAttribute("title", /cannot be renamed or deleted/);
		expect(
			await reason.evaluate((el) => getComputedStyle(el).pointerEvents),
		).not.toBe("none");
	});

	test("a graded scratch assignment opens read-only from preview and direct link", async ({
		page,
		request,
	}) => {
		const project = await submitScratchAsStudent(
			page,
			scratchGraded.name,
			scratchGraded.title,
		);
		const [submission] = await getList<{ name: string }>(
			request,
			"CS17 Assignment Submission",
			{ fields: ["name"], filters: { assignment: scratchGraded.name }, limit: 1 },
		);
		await createDoc(request, "CS17 Assignment Grade", {
			assignment: scratchGraded.name,
			submission: submission.name,
			marks_obtained: 0,
			is_published: 1,
		});

		await page.goto("/dashboard/assignments");
		const row = page.locator("tr", { hasText: scratchGraded.title });
		await row.getByRole("button", { name: "Preview" }).click();
		await page.waitForURL(
			(url) =>
				url.pathname.endsWith("/edit") &&
				url.searchParams.get("readonly") === "1",
		);
		await expect(page.getByTitle("Scratch editor")).toBeVisible();

		await expect(page.getByText("View only")).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Submit", exact: true }),
		).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: "Save", exact: true }),
		).toHaveCount(0);

		const frame = page
			.frames()
			.find((f) => f.url().includes("scratch/editor.html"))!;
		await expect
			.poll(() =>
				frame.evaluate(() => {
					const canvas = document.querySelector(".blocklyBlockCanvas");
					return canvas ? getComputedStyle(canvas).pointerEvents : "missing";
				}),
			)
			.toBe("none");

		await page.goto(
			`/dashboard/projects/${project}/edit?assignment=${scratchGraded.name}`,
		);
		await expect(page.getByText("View only")).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Submit", exact: true }),
		).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: "Save", exact: true }),
		).toHaveCount(0);
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
