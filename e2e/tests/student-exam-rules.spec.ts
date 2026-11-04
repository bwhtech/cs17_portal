import { Page, expect, test } from "@playwright/test";

const EXAM = "E2E-RULES-EXAM";
const LOOPS = "E2E-RULES-LOOPS";
const NOW = "2026-11-03 10:00:00";

type ExamEvent = { kind: string; assignment?: string; seconds?: number; detail?: string };

function codingExam(rules: Record<string, unknown> = {}, question: Record<string, unknown> = {}) {
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
		now: NOW,
		attempt: {
			started_at: "2026-11-03 09:30:00",
			ends_at: "2026-11-03 11:30:00",
			is_paused: 0,
			finished_on: null,
		},
		questions: [
			{
				assignment: LOOPS,
				title: "Loops practice",
				marks: 10,
				project: `${LOOPS}-PROJECT`,
				state: "in_progress",
				is_locked: 0,
				is_locked_by_rule: false,
				...question,
			},
		],
		rules: {
			require_fullscreen: 0,
			count_window_switches: 0,
			paste_rule: "Allow",
			watch_copy: 0,
			...rules,
		},
	};
}

async function mockExam(page: Page, exam: () => Record<string, unknown>) {
	const events: ExamEvent[] = [];
	await page.route(/cs17_portal\.coding_exam\.get_my_coding_exam\?/, (route) =>
		route.fulfill({ json: { data: exam() } })
	);
	await page.route(/cs17_portal\.api\.get_project\?/, (route) =>
		route.fulfill({
			json: {
				data: {
					name: `${LOOPS}-PROJECT`,
					project_title: "Loops practice",
					project_type: "Python",
					code: "",
					last_saved_at: NOW,
				},
			},
		})
	);
	await page.route(/cs17_portal\.api\.get_student_assignment\?/, (route) =>
		route.fulfill({
			json: {
				data: {
					name: LOOPS,
					title: "Loops practice",
					description: "Print the numbers 1 to 5.",
					submission_type: "Python",
					sample_tests: [],
					hidden_test_count: 0,
				},
			},
		})
	);
	await page.route("**/cs17_portal.api.save_python_project", (route) =>
		route.fulfill({ json: { data: { name: `${LOOPS}-PROJECT`, last_saved_at: NOW } } })
	);
	await page.route("**/cs17_portal.exam_activity.record_exam_event", (route) => {
		events.push(route.request().postDataJSON());
		return route.fulfill({ json: { data: null } });
	});
	return (kind: string) => events.filter((event) => event.kind === kind);
}

function paste(page: Page, text: string) {
	return page.locator(".cm-content").evaluate((content, text) => {
		const clipboardData = new DataTransfer();
		clipboardData.setData("text/plain", text);
		content.dispatchEvent(
			new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true })
		);
	}, text);
}

test.describe("Student exam rules", () => {
	test("covers the exam until it runs in full screen", async ({ page }) => {
		const events = await mockExam(page, () => codingExam({ require_fullscreen: 1 }));

		await page.goto(`/dashboard/exams/${EXAM}`);
		await page.getByRole("button", { name: "Enter full screen" }).click();
		await expect(page.getByText("This exam runs in full screen.")).toBeHidden();
		await page.evaluate(() => document.exitFullscreen());

		await expect(page.getByRole("button", { name: "Return to full screen" })).toBeVisible();
		await expect
			.poll(() => events("fullscreen_exit"))
			.toEqual([{ exam: EXAM, kind: "fullscreen_exit", assignment: LOOPS }]);
	});

	test("takes a rule turned on during the exam without a reload", async ({ page }) => {
		let rules: Record<string, unknown> = {};
		await mockExam(page, () => codingExam(rules));

		await page.goto(`/dashboard/exams/${EXAM}`);
		await expect(page.locator(".cm-content")).toBeVisible();
		rules = { require_fullscreen: 1 };

		await expect(page.getByText("This exam runs in full screen.")).toBeVisible({
			timeout: 20000,
		});
	});

	test("refuses a paste that was not copied in the exam", async ({ page }) => {
		const events = await mockExam(page, () =>
			codingExam({ paste_rule: "Block outside code" })
		);

		await page.goto(`/dashboard/exams/${EXAM}`);
		await paste(page, "print(42)");

		await expect(page.getByText("Only code copied in this exam can be pasted.")).toBeVisible();
		await expect(page.locator(".cm-content")).not.toContainText("print(42)");
		await expect
			.poll(() => events("paste_blocked"))
			.toEqual([{ exam: EXAM, kind: "paste_blocked", assignment: LOOPS, detail: "1 line" }]);
	});

	test("takes a paste of code copied in the exam editor", async ({ page }) => {
		const events = await mockExam(page, () =>
			codingExam({ paste_rule: "Block outside code" })
		);

		await page.goto(`/dashboard/exams/${EXAM}`);
		const editor = page.locator(".cm-content");
		await editor.fill("print(1)");
		await editor.press("ControlOrMeta+a");
		await editor.evaluate((content) => {
			content.dispatchEvent(
				new ClipboardEvent("copy", {
					clipboardData: new DataTransfer(),
					bubbles: true,
					cancelable: true,
				})
			);
		});
		await editor.press("End");
		await paste(page, "print(1)");

		await expect(editor).toHaveText("print(1)print(1)");
		expect(events("paste_blocked")).toEqual([]);
	});

	test("takes a paste of text copied from the question", async ({ page }) => {
		const events = await mockExam(page, () =>
			codingExam({ paste_rule: "Block outside code" })
		);

		await page.goto(`/dashboard/exams/${EXAM}`);
		await page.getByText("Print the numbers 1 to 5.").click({ clickCount: 3 });
		await page.keyboard.press("ControlOrMeta+c");
		await paste(page, "Print the numbers 1 to 5.\n");

		await expect(page.locator(".cm-content")).toContainText("Print the numbers 1 to 5.");
		expect(events("paste_blocked")).toEqual([]);
	});

	test("logs a paste from outside with its line count", async ({ page }) => {
		const events = await mockExam(page, () => codingExam({ paste_rule: "Log" }));

		await page.goto(`/dashboard/exams/${EXAM}`);
		await paste(page, "for n in range(5):\n    print(n)\n");

		await expect(page.locator(".cm-content")).toContainText("print(n)");
		await expect
			.poll(() => events("paste"))
			.toEqual([{ exam: EXAM, kind: "paste", assignment: LOOPS, detail: "2 lines" }]);
	});

	test("records the time away when the student leaves the tab", async ({ page }) => {
		const events = await mockExam(page, () => codingExam());

		await page.goto(`/dashboard/exams/${EXAM}`);
		await expect(page.locator(".cm-content")).toBeVisible();
		await page.evaluate(async () => {
			const setVisibility = (state: string) => {
				Object.defineProperty(document, "visibilityState", {
					configurable: true,
					get: () => state,
				});
				document.dispatchEvent(new Event("visibilitychange"));
			};
			setVisibility("hidden");
			await new Promise((resolve) => setTimeout(resolve, 1000));
			setVisibility("visible");
		});

		await expect(
			page.getByText("You left the exam. Your teacher can see this.")
		).toBeVisible();
		await expect.poll(() => events("tab_leave").length).toBe(2);
		expect(events("tab_leave")[0]).toEqual({
			exam: EXAM,
			kind: "tab_leave",
			assignment: LOOPS,
		});
		expect(events("tab_leave")[1].seconds).toBeGreaterThanOrEqual(0.5);
	});

	test("says why a question was locked by the leave rule", async ({ page }) => {
		await mockExam(page, () =>
			codingExam({}, { state: "skipped", is_locked: 1, is_locked_by_rule: true })
		);

		await page.goto(`/dashboard/exams/${EXAM}`);

		await expect(
			page.getByText(
				"The exam rules locked it after you left the exam. Your teacher can reopen it."
			)
		).toBeVisible();
	});
});
