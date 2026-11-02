import * as fs from "fs";
import { test, expect } from "@playwright/test";
import { CS17Assignment, createTestAssignment } from "../helpers/cs17";
import { deleteDoc } from "../helpers/frappe";

const LIST_ROW = '[data-slot="list-row"]';

test.describe("Guardian dashboard", () => {
	let student: string;
	let studentName: string;
	let assignment: CS17Assignment;

	test.beforeAll(async ({ request }) => {
		let cohortName: string;
		({ student, studentName, cohortName } = JSON.parse(
			fs.readFileSync("e2e/.auth/guardian-info.json", "utf-8")
		));
		const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
			.toISOString()
			.slice(0, 10);
		assignment = await createTestAssignment(request, {
			cohort: cohortName,
			dueDate: `${inThreeDays} 12:00:00`,
		});
	});

	test.afterAll(async ({ request }) => {
		await deleteDoc(request, "CS17 Assignment", assignment.name);
	});

	test("lists the work due this week for each child", async ({ page }) => {
		await page.goto("/dashboard");

		await expect(page).toHaveURL(/\/dashboard\/guardian$/);
		const card = page.locator("article", { hasText: studentName });
		await expect(card.locator("section", { hasText: "Due in the next 7 days" })).toContainText(
			assignment.title
		);
	});

	test("a child's name opens their work", async ({ page }) => {
		await page.goto("/dashboard/guardian");
		await page.getByRole("link", { name: studentName, exact: true }).click();

		await expect(page).toHaveURL(new RegExp(`/guardian/students/${student}$`));
		await expect(page.locator(LIST_ROW, { hasText: assignment.title })).toContainText(
			"Not submitted"
		);
	});

	test("student pages send a guardian back to their dashboard", async ({ page }) => {
		await page.goto("/dashboard/assignments");

		await expect(page).toHaveURL(/\/dashboard\/guardian$/);
	});
});
