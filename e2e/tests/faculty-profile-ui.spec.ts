import { test, expect } from "@playwright/test";

test.describe("Faculty profile settings", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/dashboard/faculty/settings");
	});

	test("renames the faculty member from the profile card", async ({ page }) => {
		await page.getByRole("button", { name: "Edit name" }).click();
		await page.getByLabel("First name").fill("Renamed");
		await page.getByLabel("Last name").fill("Faculty");
		
		await page.getByRole("button", { name: "Save name" }).click();
		await expect(page.getByText("Renamed Faculty").first()).toBeVisible();
		await page.reload();
		await expect(page.getByText("Renamed Faculty").first()).toBeVisible();
	});

	test("uploads and removes a profile photo", async ({ page }) => {
		const fileChooserPromise = page.waitForEvent("filechooser");
		await page.getByRole("button", { name: /Upload photo|Change photo/ }).click();
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles({
			name: "avatar.png",
			mimeType: "image/png",
			buffer: Buffer.from(
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
				"base64",
			),
		});

		const avatar = page.getByRole("img", { name: "Profile photo" });
		await expect(avatar).toHaveAttribute("src", /\/files\//);

		await page.getByRole("button", { name: "Remove photo" }).click();
		await expect(page.getByRole("button", { name: "Upload photo" })).toBeVisible();
	});
});
