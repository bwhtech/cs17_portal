import { test, expect, Page } from "@playwright/test";
import { ensureSessionFaculty } from "../helpers";
import { LoginPage } from "../pages";

function cachedKeys(page: Page): Promise<IDBValidKey[]> {
	return page.evaluate(
		() =>
			new Promise<IDBValidKey[]>((resolve, reject) => {
				const open = indexedDB.open("keyval-store");
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
});
