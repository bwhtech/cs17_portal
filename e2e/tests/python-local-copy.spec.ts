import * as fs from "fs";
import { test, expect } from "@playwright/test";
import {
	TEST_ASSIGNMENT_PREFIX,
	cleanupTestAssignments,
	createTestAssignment,
} from "../helpers/cs17";
import { deleteDoc, getList, updateDoc } from "../helpers/frappe";
import { callAsStudent } from "../helpers/student";

let cohort: string;

test.describe("Python editor code kept on the device", () => {
	test.beforeAll(() => {
		cohort = JSON.parse(fs.readFileSync("e2e/.auth/student-info.json", "utf-8")).cohort;
	});

	test.afterAll(async ({ request }) => {
		const projects = await getList<{ name: string }>(request, "CS17 Project", {
			fields: ["name"],
			filters: {
				project_title: ["like", `${TEST_ASSIGNMENT_PREFIX}%`],
				profile: ["like", `%-${cohort}-%`],
			},
			limit: 200,
		});
		for (const project of projects) {
			await deleteDoc(request, "CS17 Project", project.name);
		}
		await cleanupTestAssignments(request, cohort);
	});

	test("code typed offline is back after a reload and reaches the server", async ({
		page,
		context,
	}) => {
		await page.goto("/dashboard/projects");
		const created = await callAsStudent(page, "cs17_portal.api.create_project", {
			project_title: `${TEST_ASSIGNMENT_PREFIX} Python Offline ${Date.now()}`,
			project_type: "Python",
		});
		await page.goto(`/dashboard/projects/${created.body.message.name}/code`);
		await page.locator(".cm-content").fill('print("saved")');
		await expect(page.getByText("Saved", { exact: true })).toBeVisible();
		await context.setOffline(true);
		await page.locator(".cm-content").fill('print("kept")');
		await expect(page.getByText("Save failed")).toBeVisible();
		await context.setOffline(false);

		page.on("dialog", (dialog) => dialog.accept());
		await page.reload();
		await expect(page.locator(".cm-content")).toHaveText('print("kept")');
		await expect(page.getByText("Saved", { exact: true })).toBeVisible();
	});

	test("a closed assignment opens with the server's code, not the copy", async ({
		page,
		context,
		request,
	}) => {
		const assignment = await createTestAssignment(request, {
			cohort,
			submissionType: "Python",
		});
		await page.goto("/dashboard");
		const started = await callAsStudent(page, "cs17_portal.api.start_python_assignment", {
			assignment: assignment.name,
		});
		await page.goto(
			`/dashboard/projects/${started.body.message.name}/code?assignment=${assignment.name}`
		);
		await expect(page.getByRole("button", { name: "Submit", exact: true })).toBeVisible();
		await page.locator(".cm-content").fill('print("saved")');
		await expect(page.getByText("Saved", { exact: true })).toBeVisible();
		await context.setOffline(true);
		await page.locator(".cm-content").fill('print("late")');
		await expect(page.getByText("Save failed")).toBeVisible();
		await context.setOffline(false);
		await updateDoc(request, "CS17 Assignment", assignment.name, {
			due_date: "2020-01-01 00:00:00",
		});

		page.on("dialog", (dialog) => dialog.accept());
		await page.reload();
		await expect(page.locator(".cm-content")).toHaveAttribute("contenteditable", "false");
		await expect(page.locator(".cm-content")).toHaveText('print("saved")');
	});
});
