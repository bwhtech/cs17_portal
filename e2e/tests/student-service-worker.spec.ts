import { test, expect, Page } from "@playwright/test";

async function reloadWithServiceWorker(page: Page) {
	await page.goto("/dashboard");
	await page.evaluate(() => navigator.serviceWorker.ready);
	const responses = page.waitForResponse("**/cs17_portal.api.get_student_assignments*");
	const fromWorker = new Map<string, boolean>();
	page.on("response", (response) =>
		fromWorker.set(new URL(response.url()).pathname, response.fromServiceWorker())
	);
	await page.reload();
	await responses;
	return fromWorker;
}

test.describe("Service worker", () => {
	test.use({ serviceWorkers: "allow" });

	test("serves the dashboard's own files on the next visit", async ({ page }) => {
		const fromWorker = await reloadWithServiceWorker(page);

		const assets = [...fromWorker].filter(([path]) =>
			path.startsWith("/assets/cs17_portal/dashboard/assets/")
		);
		expect(assets.length).toBeGreaterThan(0);
		expect(assets.every(([, served]) => served)).toBe(true);
	});

	test("never answers an API request", async ({ page }) => {
		const fromWorker = await reloadWithServiceWorker(page);

		const api = [...fromWorker].filter(([path]) => path.startsWith("/api/"));
		expect(api.length).toBeGreaterThan(0);
		expect(api.some(([, served]) => served)).toBe(false);
	});
});
