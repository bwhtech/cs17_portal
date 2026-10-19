import { test, expect } from "@playwright/test";
import { TEST_ASSIGNMENT_PREFIX } from "../helpers/cs17";
import { deleteDoc, getList } from "../helpers/frappe";
import { callAsStudent, openProjectWithUnsavedEdit } from "../helpers/student";

test.describe("Editor after a failed save", () => {
	test.afterAll(async ({ request }) => {
		const projects = await getList<{ name: string }>(request, "CS17 Project", {
			fields: ["name"],
			filters: { project_title: ["like", `${TEST_ASSIGNMENT_PREFIX}%`] },
			limit: 200,
		});
		for (const project of projects) {
			await deleteDoc(request, "CS17 Project", project.name);
		}
	});

	test("the Scratch editor saves again on the first leave and stays; a second try leaves", async ({
		page,
	}) => {
		await openProjectWithUnsavedEdit(page);
		let saves = 0;
		await page.route("**/cs17_portal.api.save_project*", (route) => {
			saves += 1;
			return route.abort();
		});
		await page.getByRole("button", { name: "Save", exact: true }).click();
		await expect(page.getByText("Save failed")).toBeVisible();
		const back = page.getByRole("link", { name: "Back to projects" });

		await back.click();
		await expect.poll(() => saves).toBe(2);
		await expect(page.getByText("Save failed")).toBeVisible();
		await expect(page).toHaveURL(/\/edit$/);

		await back.click();
		await page.waitForURL((url) => url.pathname === "/dashboard/projects");
	});

	test("the Python editor stays on the first leave; a second try leaves", async ({ page }) => {
		await page.goto("/dashboard/projects");
		const created = await callAsStudent(page, "cs17_portal.api.create_project", {
			project_title: `${TEST_ASSIGNMENT_PREFIX} Python Unsaved ${Date.now()}`,
			project_type: "Python",
		});
		let saves = 0;
		await page.route("**/cs17_portal.api.save_python_project*", (route) => {
			saves += 1;
			return route.abort();
		});
		await page.goto(`/dashboard/projects/${created.body.message.name}/code`);
		await page.locator(".cm-content").fill('print("kept")');
		await expect(page.getByText("Save failed")).toBeVisible();
		const back = page.getByRole("link", { name: "Back to projects" });

		await back.click();
		await expect.poll(() => saves).toBe(2);
		await expect(page.getByText("Save failed")).toBeVisible();
		await expect(page).toHaveURL(/\/code$/);
		await expect(page.locator(".cm-content")).toHaveText('print("kept")');

		await back.click();
		await page.waitForURL((url) => url.pathname === "/dashboard/projects");
	});

	test("the Scratch editor saves again on the first log out and stays; a second log out goes ahead", async ({
		page,
	}) => {
		await openProjectWithUnsavedEdit(page);
		let saves = 0;
		await page.route("**/cs17_portal.api.save_project*", (route) => {
			saves += 1;
			return route.abort();
		});
		let logouts = 0;
		await page.route("**/api/method/logout", (route) => {
			logouts += 1;
			return route.fulfill({ json: {} });
		});
		await page.getByRole("button", { name: "Save", exact: true }).click();
		await expect(page.getByText("Save failed")).toBeVisible();
		await page.getByRole("button", { name: "Exit zen mode" }).click();
		const confirm = page.getByRole("button", { name: "Log out", exact: true });

		await page.locator('[data-slot="sidebar"] button').last().click();
		await page.getByRole("menuitem", { name: "Log out" }).click();
		await confirm.click();
		await expect(confirm).toBeHidden();
		expect(saves).toBe(2);
		expect(logouts).toBe(0);
		await expect(page.getByText("Save failed")).toBeVisible();
		await expect(page).toHaveURL(/\/edit$/);

		const login = page.waitForRequest(
			(request) => new URL(request.url()).pathname === "/login"
		);
		await page.locator('[data-slot="sidebar"] button').last().click();
		await page.getByRole("menuitem", { name: "Log out" }).click();
		await confirm.click();
		await login;
		expect(logouts).toBe(1);
	});

	test("the Python editor stays on the first log out; a second log out goes ahead", async ({
		page,
	}) => {
		await page.goto("/dashboard/projects");
		const created = await callAsStudent(page, "cs17_portal.api.create_project", {
			project_title: `${TEST_ASSIGNMENT_PREFIX} Python Unsaved ${Date.now()}`,
			project_type: "Python",
		});
		let saves = 0;
		await page.route("**/cs17_portal.api.save_python_project*", (route) => {
			saves += 1;
			return route.abort();
		});
		let logouts = 0;
		await page.route("**/api/method/logout", (route) => {
			logouts += 1;
			return route.fulfill({ json: {} });
		});
		await page.goto(`/dashboard/projects/${created.body.message.name}/code`);
		await page.locator(".cm-content").fill('print("kept")');
		await expect(page.getByText("Save failed")).toBeVisible();
		await page.getByRole("button", { name: "Exit zen mode" }).click();
		const confirm = page.getByRole("button", { name: "Log out", exact: true });

		await page.locator('[data-slot="sidebar"] button').last().click();
		await page.getByRole("menuitem", { name: "Log out" }).click();
		await confirm.click();
		await expect(confirm).toBeHidden();
		expect(saves).toBe(2);
		expect(logouts).toBe(0);
		await expect(page.getByText("Save failed")).toBeVisible();
		await expect(page).toHaveURL(/\/code$/);
		await expect(page.locator(".cm-content")).toHaveText('print("kept")');

		const login = page.waitForRequest(
			(request) => new URL(request.url()).pathname === "/login"
		);
		await page.locator('[data-slot="sidebar"] button').last().click();
		await page.getByRole("menuitem", { name: "Log out" }).click();
		await confirm.click();
		await login;
		expect(logouts).toBe(1);
	});

	test("the Scratch editor asks before the tab closes after a failed save", async ({ page }) => {
		await openProjectWithUnsavedEdit(page);
		await page.route("**/cs17_portal.api.save_project*", (route) => route.abort());
		await page.getByRole("button", { name: "Save", exact: true }).click();
		await expect(page.getByText("Save failed")).toBeVisible();
		// The Scratch bundle asks on its own after any change, saved or not.
		await page
			.getByTitle("Scratch editor")
			.contentFrame()
			.locator("html")
			.evaluate(() => {
				window.onbeforeunload = null;
			});

		const dialog = page.waitForEvent("dialog");
		await page.close({ runBeforeUnload: true });
		expect((await dialog).type()).toBe("beforeunload");
	});

	test("the Python editor asks before the tab closes after a failed save", async ({ page }) => {
		await page.goto("/dashboard/projects");
		const created = await callAsStudent(page, "cs17_portal.api.create_project", {
			project_title: `${TEST_ASSIGNMENT_PREFIX} Python Unsaved ${Date.now()}`,
			project_type: "Python",
		});
		await page.route("**/cs17_portal.api.save_python_project*", (route) => route.abort());
		await page.goto(`/dashboard/projects/${created.body.message.name}/code`);
		await page.locator(".cm-content").fill('print("kept")');
		await expect(page.getByText("Save failed")).toBeVisible();

		const dialog = page.waitForEvent("dialog");
		await page.close({ runBeforeUnload: true });
		expect((await dialog).type()).toBe("beforeunload");
	});
});
