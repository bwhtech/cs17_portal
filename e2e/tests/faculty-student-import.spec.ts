import { test, expect } from "@playwright/test";
import {
	CS17Cohort,
	createTestCohort,
	createTestUser,
	deleteTestProfile,
	deleteTestUser,
	generateProfileLastName,
	getProfileForUser,
} from "../helpers/cs17";
import { deleteDoc } from "../helpers/frappe";

const studentEmail = `e2e-student-${Date.now()}@e2e.cs17.test`;

let cohort: CS17Cohort;
let existingUser: { name: string; email: string };

test.describe("Add students from a CSV file", () => {
	test.beforeAll(async ({ request }) => {
		cohort = await createTestCohort(request);
		existingUser = await createTestUser(request);
	});

	test.afterAll(async ({ request }) => {
		const profile = await getProfileForUser(request, studentEmail);
		if (profile) {
			await deleteTestProfile(request, profile.name);
			await deleteTestUser(request, studentEmail);
		}
		await deleteTestUser(request, existingUser.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("adds the ready rows and says why the others were skipped", async ({ page }) => {
		const csv = [
			"First name,Last name,Email,Cohort",
			`E2E,${generateProfileLastName()},${studentEmail},${cohort.name}`,
			`E2E,${generateProfileLastName()},${existingUser.email},${cohort.name}`,
		].join("\n");

		await page.goto("/dashboard");
		await page.locator('[data-slot="sidebar"] button').last().click();
		await page.getByRole("menuitem", { name: "Settings" }).click();
		await page.getByRole("tab", { name: "Add students" }).click();
		const fileChooserPromise = page.waitForEvent("filechooser");
		await page.getByRole("button", { name: "Upload CSV" }).click();
		const fileChooser = await fileChooserPromise;
		await fileChooser.setFiles({
			name: "students.csv",
			mimeType: "text/csv",
			buffer: Buffer.from(csv),
		});

		await expect(
			page.getByText("Already has a user. Add their profile in desk.")
		).toBeVisible();
		await page.getByRole("button", { name: "Add 1 student" }).click();

		await expect(page.getByText("Added 1 student. 1 skipped.")).toBeVisible();
		await expect(page.getByText("Added", { exact: true })).toBeVisible();
	});
});
