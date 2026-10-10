import { test, expect } from "@playwright/test";
import { TEST_ANNOUNCEMENT_PREFIX, cleanupTestAnnouncements } from "../helpers/cs17";
import { callMethod } from "../helpers/frappe";

test.describe("Announcements bell", () => {
	test.afterAll(async ({ request }) => {
		await cleanupTestAnnouncements(request);
	});

	test("marking an announcement as read takes it off the unread list", async ({
		page,
		request,
	}) => {
		const title = `${TEST_ANNOUNCEMENT_PREFIX} ${Date.now()}`;
		await callMethod(request, "cs17_portal.api.create_announcement", {
			title,
			content: "Please read the handbook.",
			publish: "now",
		});

		await page.goto("/dashboard/faculty");
		await page.getByRole("button", { name: /^Announcements, \d+ unread$/ }).click();
		await page.getByRole("button", { name: `Mark ${title} as read` }).click();

		await expect(page.getByText(title)).toBeHidden();
	});
});
