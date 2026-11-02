import * as fs from "fs";
import { expect, test } from "@playwright/test";
import { CS17Assignment, TEST_ASSIGNMENT_PREFIX, ensureSessionFaculty } from "../helpers/cs17";
import { createDoc, deleteDoc, getList } from "../helpers/frappe";
import { callAsStudent } from "../helpers/student";

const WRONG_PROGRAM = "n = int(input())\nprint(n * 2)";
const HINT = "What does your program print when the input is 4?";

test.describe("Python hints", () => {
	let cohort: string;
	let assignment: CS17Assignment;

	test.beforeAll(async ({ request }) => {
		cohort = JSON.parse(fs.readFileSync("e2e/.auth/student-info.json", "utf-8")).cohort;
		await ensureSessionFaculty(request);
		assignment = await createDoc<CS17Assignment>(request, "CS17 Assignment", {
			title: `${TEST_ASSIGNMENT_PREFIX} Squares ${Date.now()}`,
			cohort,
			submission_type: "Python",
			due_date: "2030-01-01 00:00:00",
			is_published: 1,
			test_cases: [{ input: "4\n", expected_output: "16\n", is_hidden: 0 }],
		});
	});

	test.afterAll(async ({ request }) => {
		for (const doctype of ["CS17 Code Run", "CS17 Project"]) {
			const rows = await getList<{ name: string }>(request, doctype, {
				fields: ["name"],
				filters: { assignment: assignment.name },
				limit: 50,
			});
			for (const row of rows) await deleteDoc(request, doctype, row.name);
		}
		await deleteDoc(request, "CS17 Assignment", assignment.name);
	});

	test("offers a hint after a failed check and lists it", async ({ page }) => {
		let failedChecks = 0;
		const hints: { hint: string; asked_at: string }[] = [];
		await page.route("**/cs17_portal.live_lab.record_code_run", (route) => {
			failedChecks += 1;
			return route.continue();
		});
		await page.route("**/cs17_portal.hints.get_hint_state*", (route) =>
			route.fulfill({
				json: {
					data: {
						enabled: true,
						after_failed_runs: 1,
						max_hints: 3,
						failed_runs: failedChecks,
						hints,
						hints_left: 3 - hints.length,
						unlocked: failedChecks >= 1,
					},
				},
			})
		);
		const asked: unknown[] = [];
		await page.route("**/cs17_portal.hints.ask_for_hint", (route) => {
			asked.push(route.request().postDataJSON());
			hints.push({ hint: HINT, asked_at: "2026-11-02 10:00:00" });
			return route.fulfill({ json: { data: hints[0] } });
		});

		await page.goto("/dashboard");
		const project = (
			await callAsStudent(page, "cs17_portal.api.start_python_assignment", {
				assignment: assignment.name,
			})
		).body.message.name;
		await page.goto(`/dashboard/projects/${project}/code?assignment=${assignment.name}`);
		await expect(
			page.getByText(
				"You can ask for up to 3 hints after 1 failed check. Your teacher sees the hints you use."
			)
		).toBeVisible();

		await page.locator(".cm-content").fill(WRONG_PROGRAM);
		await page.getByRole("button", { name: "Run tests" }).click();
		const tests = page.getByRole("tabpanel", { name: "Tests" });
		await expect(tests).toContainText("0 of 1 test passed", { timeout: 60000 });
		await tests.getByRole("button", { name: "Get a hint" }).click();

		await expect(tests.getByText("Hint 1 of 3")).toBeVisible();
		await expect(tests.getByText(HINT)).toBeVisible();
		expect(asked).toEqual([
			{
				assignment: assignment.name,
				project,
				code: WRONG_PROGRAM,
				test_results: [{ passed: false, output: "8\n" }],
			},
		]);
	});
});
