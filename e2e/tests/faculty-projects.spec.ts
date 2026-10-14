import * as fs from "fs";
import { test, expect, Page } from "@playwright/test";
import {
	CS17Assignment,
	CS17Cohort,
	CS17Profile,
	cleanupTestAssignments,
	createTestAssignment,
	createTestCohort,
	createTestFaculty,
	createTestProfile,
	deleteTestProfile,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { createDoc, deleteDoc, getList } from "../helpers/frappe";

const PROJECT_TITLE_PREFIX = "E2E Faculty Project";
const SAMPLE_PROJECT = fs.readFileSync("cs17_portal/public/scratch/sample.sb3").toString("base64");

interface CallResult {
	ok: boolean;
	status: number;
	body: { message?: any; exc_type?: string; _server_messages?: string };
}

async function callAsFaculty(page: Page, method: string, body: unknown): Promise<CallResult> {
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
			return { ok: resp.ok, status: resp.status, body: await resp.json() };
		},
		{ method, body }
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
		content: SAMPLE_PROJECT,
	});
	return created.body.message.name;
}

function spritesInEditor(page: Page): Promise<string[] | null> {
	return page
		.getByTitle("Scratch editor")
		.contentFrame()
		.locator("html")
		.evaluate(() =>
			(window as any).cs17vm?.runtime.targets.map((target: any) => target.getName())
		)
		.catch(() => null);
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

	test("shows Projects in the sidebar and opens the faculty projects page", async ({ page }) => {
		await page.goto("/dashboard/faculty");
		await page.getByRole("link", { name: "Projects", exact: true }).click();

		await expect(page).toHaveURL(/\/dashboard\/faculty\/projects$/);
		await expect(page.getByRole("button", { name: "New project" })).toBeVisible();
	});

	test("creates an arbitrary project and opens it in the editor", async ({ page }) => {
		const title = `${PROJECT_TITLE_PREFIX} UI ${Date.now()}`;

		await page.goto("/dashboard/faculty/projects");
		await page.getByRole("button", { name: "New project" }).first().click();
		await page.getByRole("menuitem", { name: "Scratch project" }).click();

		const dialog = page.getByRole("dialog");
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
		await page.getByRole("button", { name: `Actions for ${title}` }).click();
		await page.getByRole("menuitem", { name: "Rename" }).click();

		const dialog = page.getByRole("dialog");
		await expect(dialog.getByLabel("Project name")).toHaveValue(title);

		await dialog.getByLabel("Project name").fill(renamed);
		await dialog.getByRole("button", { name: "Rename" }).click();

		await expect(dialog).toBeHidden();
		await expect(page.getByText(renamed, { exact: true })).toBeVisible();
	});

	test("deletes a project that is not submitted", async ({ page }) => {
		const title = `${PROJECT_TITLE_PREFIX} Delete ${Date.now()}`;
		await page.goto("/dashboard/faculty/projects");
		await createProjectAsFaculty(page, title);

		await page.reload();
		await page.getByRole("button", { name: `Actions for ${title}` }).click();
		await page.getByRole("menuitem", { name: "Delete" }).click();

		const confirm = page.getByRole("dialog").or(page.getByRole("alertdialog"));
		await confirm.getByRole("button", { name: "Delete", exact: true }).click();

		await expect(confirm).toBeHidden();
		await expect(page.getByText(title, { exact: true })).toHaveCount(0);
	});

	test("does not offer Submit to faculty in the editor", async ({ page }) => {
		await page.goto("/dashboard/faculty/projects");
		const project = await createProjectAsFaculty(
			page,
			`${PROJECT_TITLE_PREFIX} NoSubmit ${Date.now()}`
		);

		await page.goto(`/dashboard/faculty/projects/${project}/edit`);
		await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Submit", exact: true })).toHaveCount(0);
	});

	test("keeps the opened project in the editor when zen mode is left", async ({ page }) => {
		await page.goto("/dashboard/faculty/projects");
		const project = await createProjectAsFaculty(
			page,
			`${PROJECT_TITLE_PREFIX} Zen ${Date.now()}`
		);
		let saved = "";
		await page.route("**/cs17_portal.api.save_project*", async (route) => {
			saved = route.request().postDataJSON().content;
			await route.fulfill({ json: { data: { sb3_file: "/private/files/p.sb3" } } });
		});

		await page.goto(`/dashboard/faculty/projects/${project}/edit`);
		await expect.poll(() => spritesInEditor(page)).toEqual(["Stage"]);
		const exported = await page
			.getByTitle("Scratch editor")
			.contentFrame()
			.locator("html")
			.evaluate(async () => (await (window as any).cs17vm.saveProjectSb3()).size);

		await page.getByRole("button", { name: "Exit zen mode" }).click();
		await expect(page.getByRole("button", { name: "Enter zen mode" })).toBeVisible();
		expect(await spritesInEditor(page)).toEqual(["Stage"]);
		await page.getByRole("button", { name: "Save", exact: true }).click();
		await expect.poll(() => Buffer.from(saved, "base64").length).toBe(exported);
	});

	test("opens the project again when the editor frame reloads", async ({ page }) => {
		await page.goto("/dashboard/faculty/projects");
		const project = await createProjectAsFaculty(
			page,
			`${PROJECT_TITLE_PREFIX} Reload ${Date.now()}`
		);

		await page.goto(`/dashboard/faculty/projects/${project}/edit`);
		await expect.poll(() => spritesInEditor(page)).toEqual(["Stage"]);

		await page.getByRole("button", { name: "Exit zen mode" }).click();
		const reloaded = page.waitForEvent("framenavigated", (frame) =>
			frame.url().includes("scratch/editor.html")
		);
		await page.setViewportSize({ width: 390, height: 844 });
		await reloaded;
		await expect.poll(() => spritesInEditor(page)).toEqual(["Stage"]);
	});

	test("does not save over a project that could not be opened", async ({ page }) => {
		await page.goto("/dashboard/faculty/projects");
		const project = await createProjectAsFaculty(
			page,
			`${PROJECT_TITLE_PREFIX} Unopened ${Date.now()}`
		);
		let saves = 0;
		await page.route("**/cs17_portal.api.save_project*", async (route) => {
			saves += 1;
			await route.fulfill({ json: { data: { sb3_file: "/private/files/p.sb3" } } });
		});
		await page.route("**/private/files/**", (route) => route.abort());

		await page.goto(`/dashboard/faculty/projects/${project}/edit`);
		await page.getByRole("button", { name: "Save", exact: true }).click();

		await expect(
			page.getByText("The project is not loaded. Nothing was saved.")
		).toBeVisible();
		expect(saves).toBe(0);
	});

	test("keeps the editor tall when zen mode is left", async ({ page }) => {
		await page.goto("/dashboard/faculty/projects");
		const project = await createProjectAsFaculty(
			page,
			`${PROJECT_TITLE_PREFIX} Height ${Date.now()}`
		);

		await page.goto(`/dashboard/faculty/projects/${project}/edit`);
		await page.getByRole("button", { name: "Exit zen mode" }).click();
		await expect(page.getByRole("button", { name: "Enter zen mode" })).toBeVisible();

		const frame = await page.getByTitle("Scratch editor").boundingBox();
		expect(frame?.height).toBeGreaterThan(400);
	});

	test("a faculty member without System Manager creates and opens a project", async ({
		browser,
		request,
	}) => {
		const faculty = await createTestFaculty(request, []);
		const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
		await context.request.post("/api/method/login", {
			form: { usr: faculty.email, pwd: faculty.password },
		});
		const page = await context.newPage();
		const title = `${PROJECT_TITLE_PREFIX} No Role ${Date.now()}`;

		await page.goto("/dashboard/faculty/projects");
		const project = await createProjectAsFaculty(page, title);
		await page.goto(`/dashboard/faculty/projects/${project}/edit`);

		await expect(page.getByRole("heading", { name: title })).toBeVisible();
		await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
		await context.close();
	});

	test("rejects a faculty submitting a project to an assignment", async ({ page }) => {
		await page.goto("/dashboard/faculty/projects");
		const project = await createProjectAsFaculty(
			page,
			`${PROJECT_TITLE_PREFIX} Submit ${Date.now()}`
		);

		const submitted = await callAsFaculty(page, "cs17_portal.api.submit_scratch_project", {
			assignment: scratch.name,
			project,
		});
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
		const listed = await page.evaluate(async () => {
			const resp = await fetch("/api/method/cs17_portal.api.list_my_projects");
			return { ok: resp.ok, status: resp.status, body: await resp.json() };
		});
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

	test("runs a Python project and shows what it prints", async ({ page }) => {
		await page.goto("/dashboard/faculty/projects");
		await page.getByRole("button", { name: "New project" }).click();
		await page.getByRole("menuitem", { name: "Python project" }).click();
		const dialog = page.getByRole("dialog");
		await dialog
			.getByLabel("Project name")
			.fill(`${PROJECT_TITLE_PREFIX} Python ${Date.now()}`);
		await dialog.getByRole("button", { name: "Create" }).click();
		await expect(page).toHaveURL(/\/dashboard\/faculty\/projects\/PROJ-.+\/code$/);

		await page.locator(".cm-content").fill('name = input()\nprint(f"Hello, {name}!")');
		await page.getByRole("tab", { name: "Input" }).click();
		await page.getByLabel("Text your program reads").fill("Asha");
		await page.getByRole("button", { name: "Run" }).click();

		await expect(page.getByRole("tabpanel", { name: "Output" })).toContainText(
			"Hello, Asha!",
			{
				timeout: 60000,
			}
		);
	});

	test("keeps a Python project's code after a reload", async ({ page }) => {
		await page.goto("/dashboard/faculty/projects");
		const created = await callAsFaculty(page, "cs17_portal.api.create_project", {
			project_title: `${PROJECT_TITLE_PREFIX} Python Save ${Date.now()}`,
			project_type: "Python",
		});
		await page.goto(`/dashboard/faculty/projects/${created.body.message.name}/code`);

		await page.locator(".cm-content").fill('print("saved")');
		await expect(page.getByText("Saved", { exact: true })).toBeVisible();
		await page.reload();

		await expect(page.locator(".cm-content")).toHaveText('print("saved")');
	});
});
