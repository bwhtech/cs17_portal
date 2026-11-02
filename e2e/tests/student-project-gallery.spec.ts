import * as fs from "fs";
import { test, expect } from "@playwright/test";
import {
	createTestStudent,
	deleteTestProfile,
	deleteTestUser,
	TestStudent,
} from "../helpers/cs17";
import { createDoc, deleteDoc, getDoc } from "../helpers/frappe";

interface StudentInfo {
	cohort: string;
	profileName: string;
}

test.describe("Class project gallery", () => {
	let student: StudentInfo;
	let classmate: TestStudent;
	let classmateName: string;
	const projects: string[] = [];

	test.beforeAll(async ({ request }) => {
		student = JSON.parse(fs.readFileSync("e2e/.auth/student-info.json", "utf-8"));
		classmate = await createTestStudent(request, student.cohort);
		({ full_name: classmateName } = await getDoc<{ full_name: string }>(
			request,
			"CS17 Profile",
			classmate.profileName
		));
	});

	test.afterAll(async ({ request }) => {
		for (const project of projects) await deleteDoc(request, "CS17 Project", project);
		await deleteTestProfile(request, classmate.profileName);
		await deleteTestUser(request, classmate.email);
	});

	test("shares a practice project with the class", async ({ page, request }) => {
		const { name } = await createDoc<{ name: string }>(request, "CS17 Project", {
			project_title: "Maze game",
			project_type: "Scratch",
			profile: student.profileName,
		});
		projects.push(name);

		await page.goto("/dashboard/projects");
		await page.getByRole("button", { name: "Actions for Maze game" }).click();
		await page.getByRole("menuitem", { name: "Share with class" }).click();
		await expect(page.getByText("Shared", { exact: true })).toBeVisible();

		await page.getByRole("link", { name: "Gallery" }).click();
		await expect(page.getByRole("button", { name: /Maze game/ })).toBeVisible();
	});

	test("opens a classmate's project and makes a copy", async ({ page, request }) => {
		const { name } = await createDoc<{ name: string }>(request, "CS17 Project", {
			project_title: "Number guessing game",
			project_type: "Python",
			profile: classmate.profileName,
			code: 'print("Guess a number")',
			is_shared: 1,
		});
		projects.push(name);

		await page.goto("/dashboard/gallery");
		await page.getByRole("button", { name: /Number guessing game/ }).click();
		const dialog = page.getByRole("dialog", { name: "Number guessing game" });
		await expect(dialog.getByText(classmateName)).toBeVisible();
		await expect(dialog.locator(".cm-content")).toHaveText('print("Guess a number")');

		await dialog.getByRole("button", { name: "Make a copy" }).click();
		await expect(page).toHaveURL(/\/dashboard\/projects\/[^/]+\/code$/);
		projects.push(decodeURIComponent(page.url().split("/").at(-2) ?? ""));
		await expect(
			page.getByRole("heading", { name: "Number guessing game (copy)" })
		).toBeVisible();
	});
});
