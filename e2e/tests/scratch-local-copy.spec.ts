import * as fs from "fs";
import { test, expect, Page } from "@playwright/test";
import {
	TEST_ASSIGNMENT_PREFIX,
	cleanupTestAssignments,
	createTestAssignment,
} from "../helpers/cs17";
import { deleteDoc, getList, updateDoc } from "../helpers/frappe";
import { openProjectWithUnsavedEdit } from "../helpers/student";

let cohort: string;

function stageVariables(page: Page, frameTitle: string) {
	return page
		.getByTitle(frameTitle)
		.contentFrame()
		.locator("html")
		.evaluate(() =>
			Object.keys((window as any).cs17vm?.runtime.getTargetForStage()?.variables ?? {})
		);
}

function addStageVariable(page: Page) {
	return page
		.getByTitle("Scratch editor")
		.contentFrame()
		.locator("html")
		.evaluate(() =>
			(window as any).cs17vm.runtime.getTargetForStage().createVariable("kept", "kept", "")
		);
}

test.describe("Scratch editor work kept on the device", () => {
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

	test("work saved offline is back after a reload and reaches the server", async ({
		page,
		context,
	}) => {
		await openProjectWithUnsavedEdit(page);
		await context.setOffline(true);
		await addStageVariable(page);
		await page.getByRole("button", { name: "Save", exact: true }).click();
		await expect(page.getByText("Save failed")).toBeVisible();
		await context.setOffline(false);

		page.on("dialog", (dialog) => dialog.accept());
		await page.reload();
		await expect.poll(() => stageVariables(page, "Scratch editor")).toContain("kept");
		await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 30_000 });
	});

	test("a closed assignment opens with the server's project, not the copy", async ({
		page,
		context,
		request,
	}) => {
		const assignment = await createTestAssignment(request, {
			cohort,
			submissionType: "Scratch",
		});
		await openProjectWithUnsavedEdit(page, assignment.name);
		await context.setOffline(true);
		await addStageVariable(page);
		await page.getByRole("button", { name: "Save", exact: true }).click();
		await expect(page.getByText("Save failed")).toBeVisible();
		await context.setOffline(false);
		await updateDoc(request, "CS17 Assignment", assignment.name, {
			due_date: "2020-01-01 00:00:00",
		});

		page.on("dialog", (dialog) => dialog.accept());
		await page.goto(`${page.url()}?assignment=${assignment.name}`);
		await expect(page.getByText("View only")).toBeVisible();
		await expect
			.poll(() => stageVariables(page, "Scratch project player"))
			.toEqual(["spikeVar"]);
	});
});
