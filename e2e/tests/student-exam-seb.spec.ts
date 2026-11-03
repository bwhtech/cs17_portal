import { Page, Route, expect, test } from "@playwright/test";

const EXAM = "E2E-SEB-EXAM";
const MESSAGE = "Open this exam in Safe Exam Browser.";

function refuse(route: Route) {
	return route.fulfill({
		status: 403,
		json: {
			errors: [
				{
					type: "SafeExamBrowserRequiredError",
					message: MESSAGE,
					title: "Message",
					indicator: "red",
				},
			],
		},
	});
}

function runningExam() {
	return {
		name: EXAM,
		title: "Python midterm",
		instructions: "Answer every question.",
		duration_minutes: 120,
		opens_on: "2026-11-03 09:00:00",
		last_start_on: "2026-11-03 11:00:00",
		closes_on: "2026-11-03 13:00:00",
		question_order: "Any order",
		can_go_back: 0,
		banner: null,
		now: "2026-11-03 10:00:00",
		attempt: {
			started_at: "2026-11-03 09:30:00",
			ends_at: "2026-11-03 11:30:00",
			is_paused: 0,
			finished_on: null,
		},
		questions: [],
		rules: {
			require_fullscreen: 0,
			count_window_switches: 0,
			paste_rule: "Allow",
			watch_copy: 0,
		},
	};
}

function routeExam(page: Page, handler: (route: Route) => Promise<void>) {
	return page.route(/cs17_portal\.coding_exam\.get_my_coding_exam\?/, handler);
}

test.describe("Student exam in Safe Exam Browser", () => {
	test("shows how to open an exam that needs Safe Exam Browser", async ({ page }) => {
		await routeExam(page, refuse);

		await page.goto(`/dashboard/exams/${EXAM}`);

		await expect(page.getByText(MESSAGE)).toBeVisible();
		await expect(page.getByRole("link", { name: "Get Safe Exam Browser" })).toHaveAttribute(
			"href",
			"https://safeexambrowser.org/download_en.html"
		);
		await expect(page.getByText("Could not load this exam")).toBeHidden();
	});

	test("a running exam gives way once it needs Safe Exam Browser", async ({ page }) => {
		let isRefused = false;
		await routeExam(page, (route) =>
			isRefused ? refuse(route) : route.fulfill({ json: { data: runningExam() } })
		);

		await page.goto(`/dashboard/exams/${EXAM}`);
		const finish = page.getByRole("button", { name: "Finish exam" });
		await expect(finish).toBeVisible();
		isRefused = true;

		await expect(page.getByText(MESSAGE)).toBeVisible({ timeout: 20000 });
		await expect(finish).toBeHidden();
	});
});
