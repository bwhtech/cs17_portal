import { expect, test, type Page } from "@playwright/test";

const LIST_ROW = '[data-slot="list-row"]';

const EXAM = {
	name: "EXAM-0001",
	title: "Loops and lists exam",
	cohort: "CS17-A",
	quarter: null,
	instructions: "",
	duration_minutes: 120,
	opens_on: "2030-01-08 09:00:00",
	last_start_on: "2030-01-08 09:30:00",
	closes_on: "2030-01-08 12:00:00",
	question_order: "Any order",
	can_go_back: 0,
	banner: null as string | null,
	is_published: 1,
	has_attempts: true,
	questions: [
		{ assignment: "ASSIGNMENT-LOOPS", title: "Loops practice", marks: 20, max_marks: 20 },
		{ assignment: "ASSIGNMENT-LISTS", title: "List basics", marks: 10, max_marks: 10 },
	],
	changes: [],
};

const STUDENTS = [
	{
		student: "STUDENT-AARAV",
		full_name: "Aarav Sharma",
		state: "in_progress",
		started_at: "2030-01-08 09:05:00",
		ends_at: "2030-01-08 11:05:00",
		is_paused: false,
		extra_minutes: 0,
		questions: [
			{ assignment: "ASSIGNMENT-LOOPS", state: "submitted" },
			{ assignment: "ASSIGNMENT-LISTS", state: "in_progress" },
		],
		total_marks: null,
		max_marks: 30,
	},
	{
		student: "STUDENT-DIYA",
		full_name: "Diya Patel",
		state: "in_progress",
		started_at: "2030-01-08 09:10:00",
		ends_at: "2030-01-08 11:10:00",
		is_paused: false,
		extra_minutes: 0,
		questions: [
			{ assignment: "ASSIGNMENT-LOOPS", state: "in_progress" },
			{ assignment: "ASSIGNMENT-LISTS", state: "not_started" },
		],
		total_marks: null,
		max_marks: 30,
	},
];

async function mockCohorts(page: Page) {
	await page.route("**/cs17_portal.api.get_cohorts*", (route) =>
		route.fulfill({ json: { data: [EXAM.cohort] } })
	);
	await page.route("**/cs17_portal.api.get_quarters*", (route) =>
		route.fulfill({ json: { data: [] } })
	);
}

async function mockExam(page: Page, exam = EXAM) {
	await page.route(/cs17_portal\.coding_exam\.get_coding_exam\?/, (route) =>
		route.fulfill({ json: { data: exam } })
	);
	await page.route("**/cs17_portal.coding_exam.get_coding_exam_students*", (route) =>
		route.fulfill({ json: { data: STUDENTS } })
	);
}

async function fillDateTime(page: Page, label: string, value: string) {
	const input = page.getByRole("combobox", { name: label });
	await input.fill(value);
	await input.press("Enter");
}

test.describe("Faculty coding exam", () => {
	test("creates an exam with two questions", async ({ page }) => {
		await mockCohorts(page);
		await mockExam(page);
		await page.route("**/cs17_portal.coding_exam.get_coding_exams*", (route) =>
			route.fulfill({ json: { data: [] } })
		);
		await page.route("**/cs17_portal.coding_exam.get_exam_question_choices*", (route) =>
			route.fulfill({
				json: {
					data: [
						{
							name: "ASSIGNMENT-LOOPS",
							title: "Loops practice",
							max_marks: 20,
							test_count: 5,
						},
						{
							name: "ASSIGNMENT-LISTS",
							title: "List basics",
							max_marks: 10,
							test_count: 3,
						},
					],
				},
			})
		);
		const saves: Record<string, unknown>[] = [];
		await page.route("**/cs17_portal.coding_exam.save_coding_exam", (route) => {
			saves.push(route.request().postDataJSON());
			return route.fulfill({ json: { data: EXAM.name } });
		});

		await page.goto("/dashboard/faculty/exams");
		await page.getByRole("button", { name: "New exam" }).click();
		await page.getByRole("textbox", { name: /^Title/ }).fill(EXAM.title);
		await page.getByRole("combobox").filter({ hasText: "Select a cohort" }).click();
		await page.getByRole("option", { name: EXAM.cohort }).click();
		await fillDateTime(page, "Opens", "2030-01-08 12:00:00");
		await fillDateTime(page, "Last start", "2030-01-08 12:30:00");
		await fillDateTime(page, "Closes", "2030-01-08 15:00:00");
		await page.getByRole("button", { name: "Add a question" }).click();
		await page.getByRole("option", { name: /Loops practice/ }).click();
		await page.getByRole("button", { name: "Add a question" }).click();
		await page.getByRole("option", { name: /List basics/ }).click();
		await page.getByRole("button", { name: "Create exam" }).click();

		await expect(page).toHaveURL(/\/dashboard\/faculty\/exams\/EXAM-0001$/);
		expect(saves).toHaveLength(1);
		expect(saves[0]).toMatchObject({
			title: EXAM.title,
			cohort: EXAM.cohort,
			duration_minutes: 120,
			question_order: "Any order",
			questions: [
				{ assignment: "ASSIGNMENT-LOOPS", marks: 20 },
				{ assignment: "ASSIGNMENT-LISTS", marks: 10 },
			],
			is_published: 0,
		});
		expect(saves[0].opens_on).toMatch(/^2030-01-08 /);
	});

	test("adds 10 minutes for one student", async ({ page }) => {
		await mockCohorts(page);
		await mockExam(page);
		const added: unknown[] = [];
		await page.route("**/cs17_portal.coding_exam.add_exam_time", (route) => {
			added.push(route.request().postDataJSON());
			return route.fulfill({ json: { data: null } });
		});

		await page.goto(`/dashboard/faculty/exams/${EXAM.name}`);
		await page
			.locator(LIST_ROW, { hasText: "Aarav Sharma" })
			.getByRole("button", { name: "Actions for Aarav Sharma" })
			.click();
		await page.getByRole("menuitem", { name: "Add time" }).click();
		await page.getByRole("dialog").getByRole("button", { name: "Add time" }).click();

		await expect(page.getByText("Added 10 minutes for Aarav Sharma")).toBeVisible();
		expect(added).toEqual([{ exam: EXAM.name, minutes: 10, student: "STUDENT-AARAV" }]);
	});

	test("pauses the exam for everyone", async ({ page }) => {
		await mockCohorts(page);
		await mockExam(page);
		const paused: unknown[] = [];
		await page.route("**/cs17_portal.coding_exam.pause_coding_exam", (route) => {
			paused.push(route.request().postDataJSON());
			return route.fulfill({ json: { data: null } });
		});

		await page.goto(`/dashboard/faculty/exams/${EXAM.name}`);
		await page.getByRole("button", { name: "Pause", exact: true }).click();
		await page.getByRole("dialog").getByRole("button", { name: "Pause", exact: true }).click();

		await expect(page.getByText("Exam paused")).toBeVisible();
		expect(paused).toEqual([{ exam: EXAM.name }]);
	});

	test("sets a banner", async ({ page }) => {
		const banner = "Read every question before you start.";
		const exam = { ...EXAM };
		await mockCohorts(page);
		await mockExam(page, exam);
		const banners: unknown[] = [];
		await page.route("**/cs17_portal.coding_exam.set_exam_banner", (route) => {
			banners.push(route.request().postDataJSON());
			exam.banner = banner;
			return route.fulfill({ json: { data: null } });
		});

		await page.goto(`/dashboard/faculty/exams/${EXAM.name}`);
		await page.getByRole("button", { name: "Banner", exact: true }).click();
		await page.getByRole("dialog").getByLabel("Banner", { exact: true }).fill(banner);
		await page.getByRole("dialog").getByRole("button", { name: "Save", exact: true }).click();

		await expect(page.getByText(banner)).toBeVisible();
		expect(banners).toEqual([{ exam: EXAM.name, banner }]);
	});
});
