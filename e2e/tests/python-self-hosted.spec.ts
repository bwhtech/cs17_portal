import * as fs from "fs";
import { test, expect } from "@playwright/test";
import { TEST_ASSIGNMENT_PREFIX } from "../helpers/cs17";
import { deleteDoc, getList } from "../helpers/frappe";
import { callAsStudent } from "../helpers/student";

test.describe("Python served by the site", () => {
	test.afterAll(async ({ request }) => {
		const { cohort } = JSON.parse(fs.readFileSync("e2e/.auth/student-info.json", "utf-8"));
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
	});

	test("runs a program with Python loaded from the site, not a CDN", async ({ page }) => {
		const pythonRequests: string[] = [];
		page.on("request", (request) => {
			if (/pyodide|python_stdlib/.test(request.url())) pythonRequests.push(request.url());
		});
		await page.goto("/dashboard/projects");
		const created = await callAsStudent(page, "cs17_portal.api.create_project", {
			project_title: `${TEST_ASSIGNMENT_PREFIX} Python Hosted ${Date.now()}`,
			project_type: "Python",
		});
		await page.goto(`/dashboard/projects/${created.body.message.name}/code`);

		await page.locator(".cm-content").fill('print("Hello, Asha!")');
		await page.getByRole("button", { name: "Run", exact: true }).click();

		await expect(page.getByRole("tabpanel", { name: "Output" })).toContainText(
			"Hello, Asha!",
			{
				timeout: 60000,
			}
		);
		const origin = new URL(page.url()).origin;
		expect(pythonRequests.length).toBeGreaterThan(0);
		expect(pythonRequests.filter((url) => !url.startsWith(origin))).toEqual([]);
	});
});
