import { test, expect } from "@playwright/test";

test.describe("Theme persistence", () => {
	test("keeps dark mode across a refresh and on other pages", async ({ page }) => {
		await page.goto("/dashboard/settings");
		await page.getByRole("switch").click();
		await expect(page.locator("html")).toHaveClass(/dark/);

		await page.reload();
		await expect(page.locator("html")).toHaveClass(/dark/);
		await expect(page.getByRole("switch")).toHaveAttribute("aria-checked", "true");

		await page.goto("/dashboard/projects");
		await expect(page.locator("html")).toHaveClass(/dark/);

		await page.goto("/dashboard/settings");
		await page.getByRole("switch").click();
		await page.reload();
		await expect(page.locator("html")).not.toHaveClass(/dark/);
	});

	test("applies dark before the app bundle runs, so there is no flash", async ({
		page,
	}) => {
		await page.goto("/dashboard/settings");
		await page.getByRole("switch").click();
		await expect(page.locator("html")).toHaveClass(/dark/);

		await page.route("**/dashboard/assets/*.js", async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 2000));
			await route.continue();
		});

		await page.goto("/dashboard/projects", { waitUntil: "commit" });
		await expect(page.locator("html")).toHaveClass(/dark/, { timeout: 1000 });
		await expect(page.locator("#root")).toBeEmpty();
	});
});
