import * as fs from "fs";
import { test, expect } from "@playwright/test";
import { CS17Assignment, createTestAssignment } from "../helpers/cs17";
import { deleteDoc } from "../helpers/frappe";

test.describe("Student assignment page title", () => {
	let assignment: CS17Assignment;

	test.beforeAll(async ({ request }) => {
		const { cohort } = JSON.parse(fs.readFileSync("e2e/.auth/student-info.json", "utf-8"));
		assignment = await createTestAssignment(request, { cohort });
	});

	test.afterAll(async ({ request }) => {
		await deleteDoc(request, "CS17 Assignment", assignment.name);
	});

	test("drops the last assignment's name on one that does not exist", async ({ page }) => {
		await page.goto("/dashboard/assignments/E2E-MISSING/submission");
		await page.getByRole("link", { name: "Assignments", exact: true }).click();
		await page.getByRole("link", { name: assignment.title, exact: true }).click();
		await expect(page).toHaveTitle(`${assignment.title} | CS17 Portal`);

		await page.evaluate(() => history.go(-2));

		await expect(page.getByText("Assignment not found.")).toBeVisible();
		await expect(page).toHaveTitle("Assignment | CS17 Portal");
	});
});
