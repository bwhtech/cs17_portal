import { test, expect, Page } from "@playwright/test";
import { ensureSessionFaculty } from "../helpers";
import { LoginPage } from "../pages";

function cachedKeys(page: Page): Promise<IDBValidKey[]> {
	return page.evaluate(
		() =>
			new Promise<IDBValidKey[]>((resolve, reject) => {
				const open = indexedDB.open("keyval-store");
				open.onupgradeneeded = () => open.result.createObjectStore("keyval");
				open.onerror = () => reject(open.error);
				open.onsuccess = () => {
					const keys = open.result
						.transaction("keyval")
						.objectStore("keyval")
						.getAllKeys();
					keys.onerror = () => reject(keys.error);
					keys.onsuccess = () => resolve(keys.result);
				};
			})
	);
}

test.describe("Logout", () => {
	test("clears the data the dashboard cached in the browser", async ({ page, request }) => {
		await ensureSessionFaculty(request);
		await page.context().clearCookies();
		await new LoginPage(page).login(
			process.env.FRAPPE_USER || "Administrator",
			process.env.FRAPPE_PASSWORD || "admin"
		);
		await page.goto("/dashboard/faculty/submissions");
		await page.waitForLoadState("networkidle");
		await expect.poll(() => cachedKeys(page)).not.toHaveLength(0);

		await page.locator('[data-slot="sidebar"] button').last().click();
		await page.getByRole("menuitem", { name: "Log out" }).click();
		await page.getByRole("button", { name: "Log out", exact: true }).click();
		await page.waitForURL(/\/login/);

		expect(await cachedKeys(page)).toHaveLength(0);
	});

	test("removes the unsaved new assignment draft", async ({ page, request }) => {
		const user = process.env.FRAPPE_USER || "Administrator";
		const draftKey = `cs17-new-assignment-draft:${user}`;
		await ensureSessionFaculty(request);
		await page.context().clearCookies();
		await new LoginPage(page).login(user, process.env.FRAPPE_PASSWORD || "admin");
		await page.goto("/dashboard/faculty");
		await page.evaluate((key) => localStorage.setItem(key, "{}"), draftKey);

		await page.locator('[data-slot="sidebar"] button').last().click();
		await page.getByRole("menuitem", { name: "Log out" }).click();
		await page.getByRole("button", { name: "Log out", exact: true }).click();
		await page.waitForURL(/\/login/);

		expect(await page.evaluate((key) => localStorage.getItem(key), draftKey)).toBeNull();
	});

	test("removes what another user left in the browser when the next session starts", async ({
		page,
		request,
	}) => {
		const user = process.env.FRAPPE_USER || "Administrator";
		const ownCacheKey = `ns:${encodeURIComponent(user)}:["useCall:v2","cohort-submissions"]`;
		const otherCacheKey = 'ns:faculty2%40cs17.test:["useCall:v2","cohort-submissions"]';
		const draftKeys = [
			`cs17-new-assignment-draft:${user}`,
			"cs17-new-assignment-draft:faculty2@cs17.test",
			"cs17-new-assignment-draft",
		];
		await ensureSessionFaculty(request);
		await page.context().clearCookies();
		await new LoginPage(page).login(user, process.env.FRAPPE_PASSWORD || "admin");
		await page.goto("/dashboard/faculty");
		await page.evaluate(
			({ draftKeys, cacheKeys }) => {
				for (const key of draftKeys) localStorage.setItem(key, "{}");
				return new Promise<void>((resolve, reject) => {
					const open = indexedDB.open("keyval-store");
					open.onupgradeneeded = () => open.result.createObjectStore("keyval");
					open.onerror = () => reject(open.error);
					open.onsuccess = () => {
						const tx = open.result.transaction("keyval", "readwrite");
						for (const key of cacheKeys) tx.objectStore("keyval").put("[]", key);
						tx.oncomplete = () => resolve();
						tx.onerror = () => reject(tx.error);
					};
				});
			},
			{ draftKeys, cacheKeys: [ownCacheKey, otherCacheKey] }
		);

		await page.reload();

		await expect.poll(() => cachedKeys(page)).not.toContain(otherCacheKey);
		expect(await cachedKeys(page)).toContain(ownCacheKey);
		expect(
			await page.evaluate((keys) => keys.map((key) => localStorage.getItem(key)), draftKeys)
		).toEqual(["{}", null, null]);
	});

	test("stays on the page when the logout call does not reach the server", async ({
		page,
		request,
	}) => {
		await ensureSessionFaculty(request);
		await page.context().clearCookies();
		await new LoginPage(page).login(
			process.env.FRAPPE_USER || "Administrator",
			process.env.FRAPPE_PASSWORD || "admin"
		);
		await page.goto("/dashboard/faculty");
		await page.route("**/api/method/logout", (route) => route.abort());

		await page.locator('[data-slot="sidebar"] button').last().click();
		await page.getByRole("menuitem", { name: "Log out" }).click();
		await page.getByRole("button", { name: "Log out", exact: true }).click();

		await expect(page.getByText("Could not log out.")).toBeVisible();
		await expect(page).toHaveURL(/\/dashboard\/faculty$/);
	});
});
