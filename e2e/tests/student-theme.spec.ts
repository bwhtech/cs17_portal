import { test, expect, Page } from "@playwright/test";

/** The dark-mode control lives in the Settings dialog, not on a page. */
function darkModeSwitch(page: Page) {
	return page.getByRole("switch", { name: "Dark mode" });
}

/**
 * Settings is a dialog opened from the sidebar's account dropdown. The header
 * button is the dropdown trigger; the menu renders in a portal.
 */
async function openSettings(page: Page) {
	await page.locator('[data-slot="sidebar-header"] button').click();
	await page.getByRole("menuitem", { name: "Settings" }).click();
	await expect(darkModeSwitch(page)).toBeVisible();
}

test.describe("Theme persistence", () => {
	test("keeps dark mode across a refresh and on other pages", async ({ page }) => {
		await page.goto("/dashboard");
		await openSettings(page);
		await darkModeSwitch(page).click();
		await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

		await page.reload();
		await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
		await openSettings(page);
		await expect(darkModeSwitch(page)).toHaveAttribute("aria-checked", "true");

		await page.goto("/dashboard/projects");
		await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

		await openSettings(page);
		await darkModeSwitch(page).click();
		await page.reload();
		await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
	});

	test("applies dark before the app bundle runs, so there is no flash", async ({
		page,
	}) => {
		await page.goto("/dashboard");
		await openSettings(page);
		await darkModeSwitch(page).click();
		await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

		await page.route("**/dashboard/assets/*.js", async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 2000));
			await route.continue();
		});

		await page.goto("/dashboard/projects", { waitUntil: "commit" });
		await expect(page.locator("html")).toHaveAttribute("data-theme", "dark", {
			timeout: 1000,
		});
		await expect(page.locator("#app")).toBeEmpty();
	});
});
