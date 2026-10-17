import { test, expect, Page } from "@playwright/test";

async function openSettings(page: Page) {
	await page.goto("/dashboard");
	await page.locator('[data-slot="sidebar"] button').last().click();
	await page.getByRole("menuitem", { name: "Settings" }).click();
	await page.getByRole("tab", { name: "Profile" }).click();
	await expect(page.getByLabel("First name")).toBeVisible();
}

const uploadPhotoButton = (page: Page) =>
	page.getByRole("button", { name: "Upload profile picture" });
const photoEditor = (page: Page) => page.getByRole("dialog", { name: "Edit photo" });

test.describe("Faculty profile settings", () => {
	test("says which name is missing when a name is cleared", async ({ page }) => {
		await openSettings(page);
		await page.getByLabel("First name").fill("");
		await page.getByLabel("First name").blur();
		await expect(page.getByText("Add your first name.")).toBeVisible();
	});

	test("keeps a new last name across a reload", async ({ page }) => {
		await openSettings(page);
		await page.getByLabel("Last name").fill("Renamed");
		await page.getByLabel("Last name").blur();
		await expect(page.getByText("Name saved")).toBeVisible();

		await openSettings(page);
		await expect(page.getByLabel("Last name")).toHaveValue("Renamed");
	});

	test("uploads and removes a profile photo", async ({ page }) => {
		await openSettings(page);
		const fileChooserPromise = page.waitForEvent("filechooser");
		await uploadPhotoButton(page).click();
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles({
			name: "avatar.png",
			mimeType: "image/png",
			buffer: Buffer.from(
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
				"base64"
			),
		});
		await photoEditor(page).getByRole("button", { name: "Save" }).click();
		await expect(photoEditor(page)).toBeHidden();

		await openSettings(page);
		await page.getByRole("button", { name: "Profile picture options" }).click();
		await page.getByRole("menuitem", { name: "Remove photo" }).click();
		await expect(uploadPhotoButton(page)).toBeVisible();

		await openSettings(page);
		await expect(uploadPhotoButton(page)).toBeVisible();
	});

	test("names the zoom slider in the crop step", async ({ page }) => {
		await openSettings(page);
		const fileChooserPromise = page.waitForEvent("filechooser");
		await uploadPhotoButton(page).click();
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles({
			name: "avatar.png",
			mimeType: "image/png",
			buffer: Buffer.from(
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
				"base64"
			),
		});
		await expect(photoEditor(page).getByRole("slider", { name: "Zoom" })).toBeVisible();
	});

	test("shows a failed name save on the field", async ({ page }) => {
		await openSettings(page);
		await page.route("**/cs17_portal.api.update_my_profile*", (route) => route.abort());
		await page.getByLabel("Last name").fill("Faculty");
		await page.getByLabel("Last name").blur();
		await expect(page.getByLabel("Last name")).toHaveAccessibleErrorMessage(
			"Could not save your name."
		);
	});

	test("uploads the zoomed crop of a photo", async ({ page }) => {
		await openSettings(page);
		const uploads: string[] = [];
		await page.route("**/api/method/upload_file", (route) => {
			const boundary = route.request().headers()["content-type"].split("boundary=")[1];
			uploads.push(
				route.request().postDataBuffer()!.toString("latin1").replaceAll(boundary, "")
			);
			return route.abort();
		});
		const fileChooserPromise = page.waitForEvent("filechooser");
		await uploadPhotoButton(page).click();
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles({
			name: "avatar.png",
			mimeType: "image/png",
			buffer: Buffer.from(
				"iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAADUlEQVR42mP4zwAE/wEHAAH/PX2MSQAAAABJRU5ErkJggg==",
				"base64"
			),
		});
		await photoEditor(page).getByRole("button", { name: "Save" }).click();
		await expect.poll(() => uploads.length).toBe(1);
		await photoEditor(page).getByRole("button", { name: "Zoom in" }).click();
		await photoEditor(page).getByRole("button", { name: "Save" }).click();
		await expect.poll(() => uploads.length).toBe(2);
		expect(uploads[1]).not.toBe(uploads[0]);
	});

	test("uploads the dragged crop of a photo", async ({ page }) => {
		await openSettings(page);
		const uploads: string[] = [];
		await page.route("**/api/method/upload_file", (route) => {
			const boundary = route.request().headers()["content-type"].split("boundary=")[1];
			uploads.push(
				route.request().postDataBuffer()!.toString("latin1").replaceAll(boundary, "")
			);
			return route.abort();
		});
		const fileChooserPromise = page.waitForEvent("filechooser");
		await uploadPhotoButton(page).click();
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles({
			name: "avatar.png",
			mimeType: "image/png",
			buffer: Buffer.from(
				"iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAADUlEQVR42mP4zwAE/wEHAAH/PX2MSQAAAABJRU5ErkJggg==",
				"base64"
			),
		});
		await photoEditor(page).getByRole("button", { name: "Save" }).click();
		await expect.poll(() => uploads.length).toBe(1);
		const photo = (await photoEditor(page).locator("img").boundingBox())!;
		await page.mouse.move(photo.x + photo.width / 2, photo.y + photo.height / 2);
		await page.mouse.down();
		await page.mouse.move(photo.x + photo.width / 2 + 100, photo.y + photo.height / 2);
		await page.mouse.up();
		await photoEditor(page).getByRole("button", { name: "Save" }).click();
		await expect.poll(() => uploads.length).toBe(2);
		expect(uploads[1]).not.toBe(uploads[0]);
	});

	test("uploads the rotated crop of a photo", async ({ page }) => {
		await openSettings(page);
		const uploads: string[] = [];
		await page.route("**/api/method/upload_file", (route) => {
			const boundary = route.request().headers()["content-type"].split("boundary=")[1];
			uploads.push(
				route.request().postDataBuffer()!.toString("latin1").replaceAll(boundary, "")
			);
			return route.abort();
		});
		const fileChooserPromise = page.waitForEvent("filechooser");
		await uploadPhotoButton(page).click();
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles({
			name: "avatar.png",
			mimeType: "image/png",
			buffer: Buffer.from(
				"iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAIAAAB7QOjdAAAADUlEQVR42mP4zwAE/wEHAAH/PX2MSQAAAABJRU5ErkJggg==",
				"base64"
			),
		});
		await photoEditor(page).getByRole("button", { name: "Save" }).click();
		await expect.poll(() => uploads.length).toBe(1);
		await photoEditor(page).getByRole("button", { name: "Rotate" }).click();
		await photoEditor(page).getByRole("button", { name: "Save" }).click();
		await expect.poll(() => uploads.length).toBe(2);
		expect(uploads[1]).not.toBe(uploads[0]);
	});

	test("refuses a text file as a photo", async ({ page }) => {
		await openSettings(page);
		const fileChooserPromise = page.waitForEvent("filechooser");
		await uploadPhotoButton(page).click();
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles({
			name: "avatar.txt",
			mimeType: "text/plain",
			buffer: Buffer.from("e2e avatar"),
		});
		await expect(page.getByText("Only PNG and JPG images are allowed")).toBeVisible();
	});
});
