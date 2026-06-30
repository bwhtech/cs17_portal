import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages";
import { isLoggedIn } from "../helpers";

// Guarded both server-side (www/dashboard.py redirects guests) and client-side (useAuthGuard).
const DASHBOARD_PATH = "/dashboard/assignments";

interface FrappeBoot {
	current_user?: string;
}

function readBoot(page: import("@playwright/test").Page) {
	return page.evaluate(
		() => (window as unknown as { frappe_boot?: FrappeBoot }).frappe_boot ?? null,
	);
}

test.describe("Dashboard access - authenticated", () => {
	test("loads the dashboard without redirecting to login", async ({ page }) => {
		await page.goto(DASHBOARD_PATH);
		await page.waitForLoadState("networkidle");

		await expect(page).not.toHaveURL(/.*login.*/);
	});

	test("boots with the logged-in user (not Guest)", async ({ page }) => {
		await page.goto(DASHBOARD_PATH);
		await page.waitForLoadState("networkidle");

		const boot = await readBoot(page);
		expect(boot?.current_user).toBeTruthy();
		expect(boot?.current_user).not.toBe("Guest");
	});

	test("verifies the session via API", async ({ request }) => {
		expect(await isLoggedIn(request)).toBe(true);
	});
});

test.describe("Dashboard access - unauthenticated", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("redirects a guest to login", async ({ page }) => {
		await page.goto(DASHBOARD_PATH);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveURL(/.*login.*/);
	});

	test("preserves the requested path in redirect-to", async ({ page }) => {
		await page.goto(DASHBOARD_PATH);
		await page.waitForLoadState("networkidle");

		await expect(page).toHaveURL(/redirect-to=.*dashboard/);
	});

	test("logs in via the UI", async ({ page }) => {
		const loginPage = new LoginPage(page);
		await loginPage.login(
			process.env.FRAPPE_USER || "Administrator",
			process.env.FRAPPE_PASSWORD || "admin",
		);

		await expect(page).not.toHaveURL(/.*login.*/);
	});

	test("rejects invalid credentials", async ({ page }) => {
		const loginPage = new LoginPage(page);
		await loginPage.goto();
		await loginPage.fillCredentials("invalid@example.com", "wrongpassword");
		await loginPage.submit();

		await loginPage.expectToBeOnLoginPage();
	});
});
