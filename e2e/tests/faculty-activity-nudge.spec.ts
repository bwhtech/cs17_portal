import { expect, test } from "@playwright/test";
import {
	CS17Cohort,
	CS17Profile,
	createTestCohort,
	createTestProfile,
	deleteTestProfile,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { deleteDoc } from "../helpers/frappe";

const LIST_ROW = '[data-slot="list-row"]';

let cohort: CS17Cohort;
let student: CS17Profile;

test.describe("Activity reminder", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		student = await createTestProfile(request, { cohort: cohort.name });
	});

	test.afterAll(async ({ request }) => {
		await deleteTestProfile(request, student.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("sends a reminder to the students ticked", async ({ page }) => {
		await page.goto("/dashboard/faculty/activity");
		await page.getByRole("combobox", { name: "Cohort" }).click();
		await page.getByRole("listbox").waitFor();
		await page.keyboard.type(cohort.name);
		await page.keyboard.press("Enter");

		await page.locator(LIST_ROW, { hasText: student.full_name }).getByRole("checkbox").click();
		await page.getByRole("button", { name: "Send reminder" }).click();

		await expect(page.getByText("Reminder sent to 1 student")).toBeVisible();
		await expect(page.getByRole("region", { name: "Selected students" })).toBeHidden();
	});
});
