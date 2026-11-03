import { expect, test, type Page } from "@playwright/test";

const EXAM = "EXAM-0001";
const LOOPS = "ASSIGNMENT-LOOPS";
const LISTS = "ASSIGNMENT-LISTS";

const QUESTIONS = [
	{ assignment: LOOPS, title: "Loops practice" },
	{ assignment: LISTS, title: "List basics" },
];

const ATTEMPT = {
	state: "in_progress",
	started_at: "2030-01-08 09:05:00",
	ends_at: "2030-01-08 11:05:00",
	is_paused: false,
	extra_minutes: 0,
	total_marks: null,
	max_marks: 30,
};

const STUDENTS = [
	{
		...ATTEMPT,
		student: "STUDENT-DIYA",
		full_name: "Diya Patel",
		questions: [
			{ assignment: LOOPS, state: "in_progress", passed: 3, total: 5 },
			{ assignment: LISTS, state: "not_started", passed: null, total: null },
		],
		current_question: LOOPS,
		last_active_at: "2030-01-08 09:48:00",
		alerts: 0,
		stuck: true,
	},
	{
		...ATTEMPT,
		student: "STUDENT-AARAV",
		full_name: "Aarav Sharma",
		questions: [
			{ assignment: LOOPS, state: "submitted", passed: 5, total: 5 },
			{ assignment: LISTS, state: "in_progress", passed: null, total: null },
		],
		current_question: LISTS,
		last_active_at: "2030-01-08 09:59:00",
		alerts: 1,
		stuck: false,
	},
];

const TAB_LEAVE = {
	name: "a1b2c3d4e5",
	student: "STUDENT-AARAV",
	student_name: "Aarav Sharma",
	assignment: LISTS,
	kind: "tab_leave",
	occurred_at: "2030-01-08 09:58:00",
	seconds: 42,
	detail: null,
	modified: "2030-01-08 09:58:42.000000",
};

const FULLSCREEN_EXIT = {
	name: "f6g7h8i9j0",
	student: "STUDENT-DIYA",
	student_name: "Diya Patel",
	assignment: LOOPS,
	kind: "fullscreen_exit",
	occurred_at: "2030-01-08 10:00:05",
	seconds: 0,
	detail: null,
	modified: "2030-01-08 10:00:05.000000",
};

function examLive(events: unknown[]) {
	return {
		title: "Python midterm",
		now: "2030-01-08 10:00:00",
		questions: QUESTIONS,
		students: STUDENTS,
		events,
	};
}

async function mockExamLive(page: Page, events: (since: string | null) => unknown[]) {
	await page.route("**/cs17_portal.exam_live.get_exam_live*", (route) =>
		route.fulfill({
			json: {
				data: examLive(events(new URL(route.request().url()).searchParams.get("since"))),
			},
		})
	);
}

test.describe("Faculty live exam board", () => {
	test("opens from the exam page with the stuck student first", async ({ page }) => {
		await page.route("**/cs17_portal.api.get_cohorts*", (route) =>
			route.fulfill({ json: { data: ["CS17-A"] } })
		);
		await page.route("**/cs17_portal.api.get_quarters*", (route) =>
			route.fulfill({ json: { data: [] } })
		);
		await page.route(/cs17_portal\.coding_exam\.get_coding_exam\?/, (route) =>
			route.fulfill({
				json: {
					data: {
						name: EXAM,
						title: "Python midterm",
						cohort: "CS17-A",
						quarter: null,
						instructions: "",
						duration_minutes: 120,
						opens_on: "2030-01-08 09:00:00",
						last_start_on: "2030-01-08 09:30:00",
						closes_on: "2030-01-08 12:00:00",
						question_order: "Any order",
						can_go_back: 0,
						banner: null,
						is_published: 1,
						has_attempts: true,
						questions: QUESTIONS.map((question) => ({
							...question,
							marks: 15,
							max_marks: 15,
						})),
						changes: [],
					},
				},
			})
		);
		await page.route("**/cs17_portal.coding_exam.get_coding_exam_students*", (route) =>
			route.fulfill({ json: { data: STUDENTS } })
		);
		await mockExamLive(page, () => []);

		await page.goto(`/dashboard/faculty/exams/${EXAM}`);
		await page.getByRole("link", { name: "Live", exact: true }).click();
		const firstCard = page
			.getByRole("listitem")
			.filter({ has: page.getByRole("button", { name: "View code", exact: true }) })
			.first();

		await expect(page).toHaveURL(new RegExp(`/dashboard/faculty/exams/${EXAM}/live$`));
		await expect(firstCard).toContainText("Diya Patel");
		await expect(firstCard).toContainText("Stuck");
		await expect(firstCard).toContainText("3 of 5");
	});

	test("lists alerts and shows a toast for a new one", async ({ page }) => {
		const sinces: (string | null)[] = [];
		await mockExamLive(page, (since) => {
			sinces.push(since);
			return since ? [TAB_LEAVE, FULLSCREEN_EXIT] : [TAB_LEAVE];
		});

		await page.goto(`/dashboard/faculty/exams/${EXAM}/live`);

		await expect(
			page.getByText("Aarav Sharma left the tab for 42 s, Question 2")
		).toBeVisible();
		await expect(
			page
				.locator("[data-sonner-toast]")
				.getByText("Diya Patel left full screen, Question 1")
		).toBeVisible({ timeout: 20000 });
		expect(sinces.slice(0, 2)).toEqual([null, TAB_LEAVE.modified]);
	});

	test("shows a student's latest autosave read only", async ({ page }) => {
		const code = "for number in range(5):\n    print(number)";
		await mockExamLive(page, () => []);
		await page.route("**/cs17_portal.exam_live.get_exam_question_code*", (route) =>
			route.fulfill({ json: { data: { code, last_saved_at: "2030-01-08 09:48:00" } } })
		);

		await page.goto(`/dashboard/faculty/exams/${EXAM}/live`);
		await page
			.getByRole("listitem")
			.filter({ hasText: "Diya Patel" })
			.getByRole("button", { name: "View code", exact: true })
			.click();
		const editor = page.getByRole("dialog").locator(".cm-content");

		await expect(editor).toContainText("print(number)");
		await expect(editor).toHaveAttribute("contenteditable", "false");
	});
});
