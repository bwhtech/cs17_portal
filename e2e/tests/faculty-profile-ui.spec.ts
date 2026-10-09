import { test, expect, Page } from "@playwright/test";

/**
 * Settings is a dialog opened from the sidebar's account dropdown. The header
 * button is the dropdown trigger; the menu renders in a portal.
 */
async function openSettings(page: Page) {
	await page.goto("/dashboard");
	await page.locator('[data-slot="sidebar-header"] button').click();
	await page.getByRole("menuitem", { name: "Settings" }).click();
	await expect(page.getByLabel("First name")).toBeVisible();
}

const saveButton = (page: Page) => page.getByRole("button", { name: "Save", exact: true });
const removePhotoButton = (page: Page) => page.getByRole("button", { name: "Remove photo" });

test.describe("Faculty profile settings", () => {
	// The first name stays "E2E": cleanup finds test profiles by that prefix.
	test("keeps a new last name across a reload", async ({ page }) => {
		await openSettings(page);
		await page.getByLabel("Last name").fill("Renamed");
		await saveButton(page).click();
		await expect(page.getByText("Profile saved")).toBeVisible();

		await openSettings(page);
		await expect(page.getByLabel("Last name")).toHaveValue("Renamed");
	});

	test("uploads and removes a profile photo", async ({ page }) => {
		await openSettings(page);
		const fileChooserPromise = page.waitForEvent("filechooser");
		await page.getByRole("button", { name: "Change photo" }).click();
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles({
			name: "avatar.png",
			mimeType: "image/png",
			buffer: Buffer.from(
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
				"base64",
			),
		});
		await expect(removePhotoButton(page)).toBeVisible();
		await saveButton(page).click();
		await expect(page.getByText("Profile saved")).toBeVisible();

		await openSettings(page);
		await removePhotoButton(page).click();
		await saveButton(page).click();
		await expect(page.getByText("Profile saved")).toBeVisible();

		await openSettings(page);
		await expect(removePhotoButton(page)).toBeHidden();
	});
});
