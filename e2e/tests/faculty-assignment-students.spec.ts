import { test, expect } from "@playwright/test";
import {
	CS17Cohort,
	CS17Profile,
	cleanupTestAssignments,
	createTestAssignment,
	createTestCohort,
	createTestProfile,
	deleteTestProfile,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { callMethod, deleteDoc } from "../helpers/frappe";

const LIST_ROW = '[data-slot="list-row"]';

let cohort: CS17Cohort;
let students: CS17Profile[];

test.describe("Assignment students", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		students = [
			await createTestProfile(request, { profileType: "Student", cohort: cohort.name }),
			await createTestProfile(request, { profileType: "Student", cohort: cohort.name }),
		];
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestAssignments(request);
		for (const student of students) await deleteTestProfile(request, student.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("hands two assignments out at random, one student each", async ({ page, request }) => {
		const assignments = [
			await createTestAssignment(request, { cohort: cohort.name }),
			await createTestAssignment(request, {
				cohort: cohort.name,
				title: "E2E Assignment Second",
			}),
		];

		await page.goto("/dashboard/faculty/assignments");
		for (const assignment of assignments) {
			await page
				.locator(LIST_ROW, { hasText: assignment.title })
				.getByRole("checkbox")
				.click();
		}
		await page.getByRole("button", { name: "Hand out at random" }).click();
		await page.getByRole("button", { name: "Confirm" }).click();

		for (const assignment of assignments) {
			await expect(
				page
					.locator(LIST_ROW, { hasText: assignment.title })
					.getByText("1 student", { exact: true })
			).toBeVisible();
		}
	});

	test("gives an assignment to a picked student", async ({ page, request }) => {
		const assignment = await createTestAssignment(request, { cohort: cohort.name });

		await page.goto(`/dashboard/faculty/assignments/${assignment.name}`);
		await page.getByRole("button", { name: "Students" }).click();
		const dialog = page.getByRole("dialog");
		await dialog.getByText("Whole cohort", { exact: true }).click();
		await page.getByRole("option", { name: students[0].full_name! }).click();
		await page.keyboard.press("Escape");
		await dialog.getByRole("button", { name: "Save" }).click();

		await expect(page.locator(LIST_ROW, { hasText: students[1].full_name! })).toHaveCount(0);
		await expect(page.locator(LIST_ROW, { hasText: students[0].full_name! })).toBeVisible();
	});

	test("opens a handed out assignment to everyone", async ({ page, request }) => {
		const assignment = await createTestAssignment(request, { cohort: cohort.name });
		await callMethod(request, "cs17_portal.api.set_assignment_students", {
			assignment: assignment.name,
			students: [students[0].name],
		});

		await page.goto("/dashboard/faculty/assignments");
		const row = page.locator(LIST_ROW, { hasText: assignment.title });
		await row.getByRole("checkbox").click();
		await page.getByRole("button", { name: "Open to everyone" }).click();
		await page.getByRole("button", { name: "Confirm" }).click();

		await expect(row.getByText("1 student", { exact: true })).toHaveCount(0);
	});
});
