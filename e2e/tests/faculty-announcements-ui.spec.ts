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

	test("keeps the unread list when a poll fails", async ({ page, request }) => {
		const title = `${TEST_ANNOUNCEMENT_PREFIX} ${Date.now()}`;
		const announcements = "**/cs17_portal.api.get_faculty_announcements*";
		await callMethod(request, "cs17_portal.api.create_announcement", {
			title,
			content: "Please read the handbook.",
			publish: "now",
		});
		const bell = page.getByRole("button", { name: /^Announcements, \d+ unread$/ });

		await page.clock.install();
		await page.goto("/dashboard/faculty");
		await expect(bell).toBeVisible();
		await page.route(announcements, (route) => route.fulfill({ status: 500 }));
		const failedPoll = page.waitForResponse(announcements);
		await page.clock.fastForward(45_000);
		await failedPoll;
		await bell.click();

		await expect(page.getByText(title)).toBeVisible();
	});
});

test.describe("Faculty announcements", () => {
	test.afterAll(async ({ request }) => {
		await cleanupTestAnnouncements(request);
	});

	test("shows the server's message when a delete is refused", async ({ page, request }) => {
		const title = `${TEST_ANNOUNCEMENT_PREFIX} ${Date.now()}`;
		await callMethod(request, "cs17_portal.api.create_announcement", {
			title,
			content: "Please read the handbook.",
		});
		await page.route("**/cs17_portal.api.delete_announcement*", (route) =>
			route.fulfill({
				status: 403,
				json: { errors: [{ type: "PermissionError", message: "Not permitted" }] },
			})
		);

		await page.goto("/dashboard/faculty/announcements");
		await page.getByRole("button", { name: `Delete ${title}` }).click();
		await page.getByRole("button", { name: "Delete", exact: true }).click();

		await expect(page.getByRole("alert")).toHaveText("Not permitted");
	});

	test("reloads the list when an announcement went live before its edit", async ({ page }) => {
		let isPublished = 0;
		await page.route("**/cs17_portal.api.get_faculty_announcements*", (route) =>
			route.fulfill({
				json: {
					data: [
						{
							name: TEST_ANNOUNCEMENT_PREFIX,
							title: TEST_ANNOUNCEMENT_PREFIX,
							content: "Please read the handbook.",
							alert_variant: "info",
							cohort: null,
							is_dismissible: 1,
							is_published: isPublished,
							publish_on: "2000-01-01 09:00:00",
							can_edit: true,
						},
					],
				},
			})
		);
		const edit = page.getByRole("button", { name: `Edit ${TEST_ANNOUNCEMENT_PREFIX}` });

		await page.goto("/dashboard/faculty/announcements");
		await expect(edit).toBeVisible();
		isPublished = 1;
		await edit.click();
		await page.getByRole("button", { name: "Cancel" }).click();

		await expect(edit).toHaveCount(0);
	});

	test("says Announcement published when the form publishes now", async ({ page }) => {
		await page.route("**/cs17_portal.api.create_announcement*", (route) =>
			route.fulfill({ json: { data: TEST_ANNOUNCEMENT_PREFIX } })
		);

		await page.goto("/dashboard/faculty/announcements");
		await page.getByRole("button", { name: "New announcement" }).click();
		await page.getByPlaceholder("Announcement title").fill(TEST_ANNOUNCEMENT_PREFIX);
		await page.getByRole("combobox").filter({ hasText: "Save as draft" }).click();
		await page.getByRole("option", { name: "Publish now" }).click();
		await page.getByRole("button", { name: "Save", exact: true }).click();

		await expect(page.getByText("Announcement published")).toBeVisible();
	});
});
