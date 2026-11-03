import { Page, expect, test } from "@playwright/test";

const EXAM = "E2E-CODING-EXAM";
const LOOPS = "E2E-LOOPS-PRACTICE";
const GUESSING = "E2E-NUMBER-GUESSING";
const TITLES: Record<string, string> = {
	[LOOPS]: "Loops practice",
	[GUESSING]: "Number guessing",
};

const NOW = "2026-11-03 10:00:00";
const RUNNING = {
	started_at: "2026-11-03 09:30:00",
	ends_at: "2026-11-03 11:30:00",
	is_paused: 0,
	finished_on: null,
};

function question(assignment: string, state: string, isLocked = 0) {
	return {
		assignment,
		title: TITLES[assignment],
		marks: 10,
		project: `${assignment}-PROJECT`,
		state,
		is_locked: isLocked,
	};
}

function codingExam(overrides: Record<string, unknown> = {}) {
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
		attempt: RUNNING,
		questions: [question(LOOPS, "in_progress"), question(GUESSING, "not_started")],
		...overrides,
	};
}

async function mockExam(page: Page, exam: () => Record<string, unknown>) {
	await page.route(/cs17_portal\.coding_exam\.get_my_coding_exam\?/, (route) =>
		route.fulfill({ json: { data: exam() } })
	);
	await page.route(/cs17_portal\.api\.get_project\?/, (route) => {
		const project = new URL(route.request().url()).searchParams.get("project");
		return route.fulfill({
			json: {
				data: {
					name: project,
					project_title: project,
					project_type: "Python",
					code: "",
					last_saved_at: "2026-11-03 09:30:00",
				},
			},
		});
	});
	await page.route(/cs17_portal\.api\.get_student_assignment\?/, (route) => {
		const assignment = new URL(route.request().url()).searchParams.get("assignment") ?? "";
		return route.fulfill({
			json: {
				data: {
					name: assignment,
					title: TITLES[assignment],
					description: `Write the ${TITLES[assignment]} program.`,
					submission_type: "Python",
					sample_tests: [],
					hidden_test_count: 0,
				},
			},
		});
	});
	await page.route("**/cs17_portal.api.save_python_project", (route) =>
		route.fulfill({
			json: { data: { name: route.request().postDataJSON().project, last_saved_at: NOW } },
		})
	);
}

function openQuestion(page: Page, title: string) {
	return page
		.getByRole("navigation", { name: "Questions" })
		.getByRole("button", { name: new RegExp(title) })
		.click();
}

test.describe("Student coding exam", () => {
	test("starts the exam after the confirm", async ({ page }) => {
		const starts: unknown[] = [];
		await mockExam(page, () =>
			starts.length ? codingExam() : codingExam({ attempt: null, questions: [] })
		);
		await page.route("**/cs17_portal.coding_exam.start_coding_exam", (route) => {
			starts.push(route.request().postDataJSON());
			return route.fulfill({ json: { data: RUNNING } });
		});

		await page.goto(`/dashboard/exams/${EXAM}`);
		await page.getByRole("button", { name: "Start exam" }).click();
		const dialog = page.getByRole("dialog");
		await expect(
			dialog.getByText("The clock starts now and does not stop if you leave.")
		).toBeVisible();
		await dialog.getByRole("button", { name: "Start exam" }).click();

		await expect(page.getByRole("button", { name: "Finish exam" })).toBeVisible();
		await expect(page.getByRole("heading", { name: "Loops practice" })).toBeVisible();
		expect(starts).toEqual([{ exam: EXAM }]);
	});

	test("keeps each question's code when switching between them", async ({ page }) => {
		await mockExam(page, () => codingExam());

		await page.goto(`/dashboard/exams/${EXAM}`);
		await page.locator(".cm-content").fill('print("loops")');
		await openQuestion(page, "Number guessing");
		await expect(page.getByRole("heading", { name: "Number guessing" })).toBeVisible();
		await page.locator(".cm-content").fill('print("guess")');
		await openQuestion(page, "Loops practice");

		await expect(page.locator(".cm-content")).toHaveText('print("loops")');
	});

	test("locks the next question one by one and moves on after a skip", async ({ page }) => {
		const skips: unknown[] = [];
		await mockExam(page, () =>
			codingExam({
				question_order: "One by one",
				questions: skips.length
					? [
							question(LOOPS, "skipped", 1),
							{ ...question(GUESSING, "not_started"), project: null },
					  ]
					: [
							question(LOOPS, "in_progress"),
							{ ...question(GUESSING, "not_started", 1), project: null },
					  ],
			})
		);
		await page.route("**/cs17_portal.coding_exam.skip_exam_question", (route) => {
			skips.push(route.request().postDataJSON());
			return route.fulfill({ json: { data: null } });
		});
		await page.route("**/cs17_portal.coding_exam.open_exam_question", (route) =>
			route.fulfill({ json: { data: { project: `${GUESSING}-PROJECT` } } })
		);

		await page.goto(`/dashboard/exams/${EXAM}`);
		await openQuestion(page, "Number guessing");
		await expect(page.getByText("This question is locked")).toBeVisible();
		await openQuestion(page, "Loops practice");
		await page.getByRole("button", { name: "Skip", exact: true }).click();
		await page.getByRole("dialog").getByRole("button", { name: "Skip", exact: true }).click();

		await expect(page.getByRole("heading", { name: "Number guessing" })).toBeVisible();
		expect(skips).toEqual([{ exam: EXAM, assignment: LOOPS }]);
	});

	test("extra time from a poll takes away the time is up notice", async ({ page }) => {
		let endsAt = NOW;
		await mockExam(page, () => codingExam({ attempt: { ...RUNNING, ends_at: endsAt } }));

		await page.goto(`/dashboard/exams/${EXAM}`);
		const timeIsUp = page.getByText("Time is up. Your saved work is being submitted.");
		await expect(timeIsUp).toBeVisible();
		await expect(page.locator(".cm-content")).toHaveAttribute("contenteditable", "false");
		endsAt = RUNNING.ends_at;

		await expect(timeIsUp).toBeHidden({ timeout: 20000 });
		await expect(page.locator(".cm-content")).toHaveAttribute("contenteditable", "true");
	});

	test("shows the teacher's banner", async ({ page }) => {
		await mockExam(page, () => codingExam({ banner: "Question 2 reads 10 numbers, not 5." }));

		await page.goto(`/dashboard/exams/${EXAM}`);

		await expect(page.getByText("Question 2 reads 10 numbers, not 5.")).toBeVisible();
	});
});
