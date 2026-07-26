import { test, expect, Page } from "@playwright/test";
import {
	CS17Assignment,
	CS17Cohort,
	CS17Profile,
	cleanupTestAssignments,
	createTestAssignment,
	createTestCohort,
	createTestProfile,
	deleteTestProfile,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { createDoc, deleteDoc, getList } from "../helpers/frappe";

const PROJECT_TITLE_PREFIX = "E2E Faculty Project";

interface CallResult {
	ok: boolean;
	status: number;
	body: { message?: any; exc_type?: string; _server_messages?: string };
}

async function callAsFaculty(
	page: Page,
	method: string,
	body: unknown,
): Promise<CallResult> {
	await page.waitForFunction(
		() =>
			(window as any).csrf_token !== undefined ||
			(window as any).frappe?.csrf_token !== undefined,
		{ timeout: 15000 },
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
			return { ok: resp.ok, status: resp.status, body: await resp.json() };
		},
		{ method, body },
	);
}

async function createProjectAsFaculty(page: Page, title: string): Promise<string> {
	const created = await callAsFaculty(page, "cs17_portal.api.create_project", {
		project_title: title,
	});
	expect(created.ok).toBe(true);
	await callAsFaculty(page, "cs17_portal.api.save_project", {
		project: created.body.message.name,
		filename: "p.sb3",
		content: btoa("PKtest"),
	});
	return created.body.message.name;
}

test.describe("Faculty Scratch projects", () => {
	let cohort: CS17Cohort;
	let scratch: CS17Assignment;
	let student: CS17Profile;

	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		student = await createTestProfile(request, {
			profileType: "Student",
			cohort: cohort.name,
		});
		scratch = await createTestAssignment(request, {
			cohort: cohort.name,
			submissionType: "Scratch",
		});
	});

	test.afterAll(async ({ request }) => {
		const projects = await getList<{ name: string }>(request, "CS17 Project", {
			fields: ["name"],
			filters: { project_title: ["like", `${PROJECT_TITLE_PREFIX}%`] },
			limit: 200,
		});
		for (const project of projects) {
			try {
				await deleteDoc(request, "CS17 Project", project.name);
			} catch (error) {
				console.warn(`Failed to delete project ${project.name}:`, error);
			}
		}
		await cleanupTestAssignments(request);
		await deleteTestProfile(request, student.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("shows Projects in the sidebar and opens the faculty projects page", async ({
		page,
	}) => {
		await page.goto("/dashboard/faculty");
		await page.getByRole("link", { name: "Projects" }).click();

		await expect(page).toHaveURL(/\/dashboard\/faculty\/projects$/);
		await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
		await expect(page.getByText("Workspace / Dashboard")).toHaveCount(0);
	});

	test("creates an arbitrary project and opens it in the editor", async ({ page }) => {
		const title = `${PROJECT_TITLE_PREFIX} UI ${Date.now()}`;

		await page.goto("/dashboard/faculty/projects");
		await page.getByRole("button", { name: "New Project" }).click();

		const dialog = page.getByRole("dialog");
		await expect(dialog.getByRole("heading", { name: "New project" })).toBeVisible();
		await expect(dialog.getByRole("button", { name: "Create" })).toBeDisabled();

		await dialog.getByLabel("Project name").fill(title);
		await dialog.getByRole("button", { name: "Create" }).click();

		await expect(page).toHaveURL(/\/dashboard\/faculty\/projects\/PROJ-.+\/edit$/);
		await expect(page.getByRole("heading", { name: title })).toBeVisible();
		await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
	});

	test("renames a project from the projects page", async ({ page }) => {
		const title = `${PROJECT_TITLE_PREFIX} Rename ${Date.now()}`;
		const renamed = `${title} Renamed`;
		await page.goto("/dashboard/faculty/projects");
		await createProjectAsFaculty(page, title);

		await page.reload();
		await page.getByRole("button", { name: `Rename ${title}` }).click();

		const dialog = page.getByRole("dialog");
		await expect(dialog.getByRole("heading", { name: "Rename project" })).toBeVisible();
		await expect(dialog.getByLabel("Project name")).toHaveValue(title);

		await dialog.getByLabel("Project name").fill(renamed);
		await dialog.getByRole("button", { name: "Rename" }).click();

		await expect(dialog).toBeHidden();
		await expect(page.getByText(renamed)).toBeVisible();
	});

	test("deletes a project that is not submitted", async ({ page }) => {
		const title = `${PROJECT_TITLE_PREFIX} Delete ${Date.now()}`;
		await page.goto("/dashboard/faculty/projects");
		await createProjectAsFaculty(page, title);

		await page.reload();
		await page.getByRole("button", { name: `Delete ${title}` }).click();

		const confirm = page.getByRole("alertdialog");
		await expect(confirm.getByRole("heading", { name: `Delete "${title}"?` })).toBeVisible();
		await confirm.getByRole("button", { name: "Delete" }).click();

		await expect(confirm).toBeHidden();
		await expect(page.getByText(title)).toHaveCount(0);
	});

	test("does not offer Submit to faculty in the editor", async ({ page }) => {
		await page.goto("/dashboard/faculty/projects");
		const project = await createProjectAsFaculty(
			page,
			`${PROJECT_TITLE_PREFIX} NoSubmit ${Date.now()}`,
		);

		await page.goto(`/dashboard/faculty/projects/${project}/edit`);
		await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Submit" })).toHaveCount(0);
	});

	test("lists the faculty's own projects", async ({ page }) => {
		await page.goto("/dashboard/faculty/projects");
		const title = `${PROJECT_TITLE_PREFIX} List ${Date.now()}`;
		const project = await createProjectAsFaculty(page, title);

		const listed = await callAsFaculty(page, "cs17_portal.api.list_my_projects", {});
		expect(listed.ok).toBe(true);
		const names = listed.body.message.map((p: { name: string }) => p.name);
		expect(names).toContain(project);
	});

	test("rejects a faculty submitting a project to an assignment", async ({ page }) => {
		await page.goto("/dashboard/faculty/projects");
		const project = await createProjectAsFaculty(
			page,
			`${PROJECT_TITLE_PREFIX} Submit ${Date.now()}`,
		);

		const submitted = await callAsFaculty(
			page,
			"cs17_portal.api.submit_scratch_project",
			{ assignment: scratch.name, project },
		);
		expect(submitted.ok).toBe(false);
		expect(submitted.body.exc_type).toBe("PermissionError");
	});

	test("keeps another profile's project out of the faculty's list", async ({
		page,
		request,
	}) => {
		const foreign = await createDoc<{ name: string }>(request, "CS17 Project", {
			project_title: `${PROJECT_TITLE_PREFIX} Foreign ${Date.now()}`,
			profile: student.name,
		});

		await page.goto("/dashboard/faculty/projects");
		const listed = await callAsFaculty(page, "cs17_portal.api.list_my_projects", {});
		const names = listed.body.message.map((p: { name: string }) => p.name);
		expect(names).not.toContain(foreign.name);

		const saved = await callAsFaculty(page, "cs17_portal.api.save_project", {
			project: foreign.name,
			filename: "p.sb3",
			content: btoa("PKtest"),
		});
		expect(saved.ok).toBe(false);
		expect(saved.body.exc_type).toBe("PermissionError");
	});
});
