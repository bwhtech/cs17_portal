import * as fs from "fs";
import { test, expect, type Page } from "@playwright/test";
import {
	CS17Assignment,
	CS17Cohort,
	CS17Profile,
	CS17Submission,
	TEST_ANNOUNCEMENT_PREFIX,
	TEST_ASSIGNMENT_PREFIX,
	TestDefaultScale,
	TestFaculty,
	cleanupTestAssignments,
	cleanupTestDefaultScale,
	cleanupTestGrades,
	cleanupTestSubmissions,
	createTestAssignment,
	createTestCohort,
	createTestDefaultScale,
	createTestProfile,
	createTestSubmission,
	deleteTestProfile,
	ensureSessionFaculty,
} from "../helpers/cs17";
import {
	callMethod,
	createDoc,
	deleteDoc,
	getDoc,
	updateDoc,
	uploadFile,
} from "../helpers/frappe";

function draftKey(page: Page): Promise<string> {
	return page.evaluate(() => `cs17-new-assignment-draft:${(window as any).current_user}`);
}

const TERMINAL_ASSIGNMENT_ZIP =
	"UEsDBBQAAAAAAFJOTF1WucDaDwAAAA8AAAAfAAAAdGVybWluYWwtYXNzaWdubWVudC9oaXN0b3J5LnR4dGNhdCBSRUFETUUudHh0ClBLAQIUAxQAAAAAAFJOTF1WucDaDwAAAA8AAAAfAAAAAAAAAAAAAACAAQAAAAB0ZXJtaW5hbC1hc3NpZ25tZW50L2hpc3RvcnkudHh0UEsFBgAAAAABAAEATQAAAEwAAAAAAA==";

/** frappe-ui's list is divs, not a table: a row carries this slot, a cell `list-cell`. */
const LIST_ROW = '[data-slot="list-row"]';
const LIST_CELL = '[data-slot="list-cell"]';

/**
 * frappe-ui's DateTimePicker replaces `input[type="datetime-local"]`. It is a
 * typeable text input labelled by its field, and Enter commits what was typed.
 */
async function fillDateTime(page: Page, label: string, value: string) {
	const input = page.getByRole("combobox", { name: label });
	await input.fill(value);
	await input.press("Enter");
}

let cohort: CS17Cohort;
let student: CS17Profile;
let graded: CS17Assignment;

test.describe("Faculty assignment portal", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		student = await createTestProfile(request, {
			profileType: "Student",
			cohort: cohort.name,
		});
		graded = await createTestAssignment(request, {
			cohort: cohort.name,
			assignmentType: "Graded",
		});
		await createTestSubmission(request, {
			assignment: graded.name,
			student: student.name,
		});
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestGrades(request);
		await cleanupTestSubmissions(request);
		await cleanupTestAssignments(request);
		await deleteTestProfile(request, student.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("opens the assignments list from the sidebar", async ({ page }) => {
		await page.goto("/dashboard/faculty");
		await page.getByRole("link", { name: "Assignments", exact: true }).click();
		await expect(page).toHaveURL(/\/dashboard\/faculty\/assignments$/);
	});

	test("keeps the sidebar collapsed across a reload", async ({ page }) => {
		await page.goto("/dashboard/faculty");
		await page.getByRole("button", { name: "Collapse" }).click();
		await page.reload();
		await expect(page.getByRole("button", { name: "Expand" })).toBeVisible();
	});

	test("shows no workspace crumb in the header", async ({ page }) => {
		await page.goto("/dashboard/faculty/assignments");
		await expect(page.getByRole("button", { name: "New Assignment" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Workspace", exact: true })).toHaveCount(0);
	});

	test("says the list could not load when the request fails", async ({ page }) => {
		await page.route("**/cs17_portal.api.get_faculty_assignments*", (route) =>
			route.fulfill({ status: 500 })
		);
		await page.goto("/dashboard/faculty/assignments");
		await expect(page.getByText("Could not load assignments")).toBeVisible();
		await expect(page.getByText("No assignments yet.")).toHaveCount(0);
	});

	test("says an assignment could not load when the request fails", async ({ page }) => {
		await page.route("**/cs17_portal.api.get_assignment_submissions*", (route) =>
			route.fulfill({ status: 500 })
		);
		await page.goto(`/dashboard/faculty/assignments/${graded.name}`);
		await expect(page.getByText("Could not load this assignment")).toBeVisible();
		await expect(page.getByText("Assignment not found")).toHaveCount(0);
	});

	test("assigns a submission from its row", async ({ page }) => {
		await page.goto(`/dashboard/faculty/assignments/${graded.name}`);
		const row = page.locator(LIST_ROW, { hasText: student.first_name });
		await row.getByRole("button", { name: "Assign", exact: true }).click();
		await page.getByRole("option").first().click();

		await expect(row.getByRole("button", { name: /^Assigned to/ })).toBeVisible();
	});

	test("lists a student who has not submitted", async ({ page, request }) => {
		const absent = await createTestProfile(request, {
			profileType: "Student",
			cohort: cohort.name,
		});
		await page.goto(`/dashboard/faculty/assignments/${graded.name}`);

		const row = page.locator(LIST_ROW, { hasText: absent.first_name });
		await expect(row.getByText("Not submitted")).toBeVisible();

		await deleteTestProfile(request, absent.name);
	});

	test("uploads an answer sheet and opens a student's answers", async ({ page }, testInfo) => {
		const sheet = testInfo.outputPath("answers.csv");
		fs.writeFileSync(
			sheet,
			`#,Task,Expected answer,Scored,${student.first_name} ${student.last_name}\n` +
				"1,Create gallery folder,gallery/ at the assignment root,Yes,Named gallary\n"
		);
		await page.goto(`/dashboard/faculty/assignments/${graded.name}`);
		await page
			.locator("section", { hasText: "Answer sheet" })
			.locator('input[type="file"]')
			.setInputFiles(sheet);

		const row = page.locator(LIST_ROW, { hasText: student.last_name });
		await row.getByRole("button", { name: "Answers" }).click();
		await expect(
			page.getByRole("dialog").getByRole("textbox", { name: "Note on task 1" })
		).toHaveValue("Named gallary");
	});

	test("writes a note on a student's answer from a sheet with no student columns", async ({
		page,
	}, testInfo) => {
		const sheet = testInfo.outputPath("answers-only.csv");
		fs.writeFileSync(
			sheet,
			"#,Task,Expected answer,Scored\n1,Create gallery folder,gallery/ at the assignment root,Yes\n"
		);
		await page.goto(`/dashboard/faculty/assignments/${graded.name}`);
		const uploaded = page.waitForResponse(/answer_sheet\.upload_answer_sheet/);
		await page
			.locator("section", { hasText: "Answer sheet" })
			.locator('input[type="file"]')
			.setInputFiles(sheet);
		await uploaded;
		await page.waitForResponse(/answer_sheet\.get_answer_sheet/);

		const row = page.locator(LIST_ROW, { hasText: student.last_name });
		await row.getByRole("button", { name: "Answers" }).click();
		const note = page.getByRole("dialog").getByRole("textbox", { name: "Note on task 1" });
		await expect(note).toHaveValue("");
		await note.fill("Named gallary");
		const saved = page.waitForResponse(/answer_sheet\.set_answer_remark/);
		await note.press("Tab");
		await saved;

		await page.reload();
		await row.getByRole("button", { name: "Answers" }).click();
		await expect(note).toHaveValue("Named gallary");
	});

	test("shows a submission with no submit time as submitted", async ({ page, request }) => {
		const other = await createTestProfile(request, {
			profileType: "Student",
			cohort: cohort.name,
		});
		const submission = await createTestSubmission(request, {
			assignment: graded.name,
			student: other.name,
		});
		await updateDoc(request, "CS17 Assignment Submission", submission.name, {
			submitted_at: null,
		});
		await page.goto(`/dashboard/faculty/assignments/${graded.name}`);

		const row = page.locator(LIST_ROW, { hasText: other.last_name });
		await expect(row.getByText("Submitted", { exact: true })).toBeVisible();

		await deleteDoc(request, "CS17 Assignment Submission", submission.name);
		await deleteTestProfile(request, other.name);
	});

	test("creates and publishes an assignment from the sheet", async ({ page }) => {
		const title = `${TEST_ASSIGNMENT_PREFIX} UI ${Date.now()}`;
		await page.goto("/dashboard/faculty/assignments");
		await page.getByRole("button", { name: "New Assignment" }).click();

		await page.getByPlaceholder("Assignment title").fill(title);
		await page
			.getByRole("combobox")
			.filter({ hasText: /Select a cohort|No cohort/ })
			.click();
		await page.getByRole("listbox").waitFor();
		await page.keyboard.type(cohort.name);
		await page.keyboard.press("Enter");
		await fillDateTime(page, "Due Date", "2030-01-01 09:00:00");
		await page.getByRole("combobox").filter({ hasText: "Save as draft" }).click();
		await page.getByRole("option", { name: "Publish now" }).click();

		await page.getByRole("button", { name: "Create Assignment" }).click();

		const row = page.locator(LIST_ROW, { hasText: title });
		await expect(row).toBeVisible();
		await expect(row.getByText("Published")).toBeVisible();
	});

	test("offers Scratch as a submission type and saves it", async ({ page }) => {
		const title = `${TEST_ASSIGNMENT_PREFIX} Scratch ${Date.now()}`;
		await page.goto("/dashboard/faculty/assignments");
		await page.getByRole("button", { name: "New Assignment" }).click();

		await page.getByPlaceholder("Assignment title").fill(title);
		await page
			.getByRole("combobox")
			.filter({ hasText: /Select a cohort|No cohort/ })
			.click();
		await page.getByRole("listbox").waitFor();
		await page.keyboard.type(cohort.name);
		await page.keyboard.press("Enter");
		await fillDateTime(page, "Due Date", "2030-03-03 09:00:00");

		await page.getByRole("combobox").filter({ hasText: "Any" }).click();
		await page.getByRole("option", { name: "Scratch", exact: true }).click();

		await page.getByRole("combobox").filter({ hasText: "Save as draft" }).click();
		await page.getByRole("option", { name: "Publish now" }).click();
		await page.getByRole("button", { name: "Create Assignment" }).click();

		const row = page.locator(LIST_ROW, { hasText: title });
		await expect(row).toBeVisible();
		// The submission type now rides the row's meta line, not a cell of its own.
		await expect(row).toContainText("Scratch");
	});

	test("keeps a closed draft in localStorage and restores it on reopen", async ({ page }) => {
		const title = `${TEST_ASSIGNMENT_PREFIX} Draft ${Date.now()}`;
		await page.goto("/dashboard/faculty/assignments");
		await page.evaluate((key) => localStorage.removeItem(key), await draftKey(page));

		await page.getByRole("button", { name: "New Assignment" }).click();
		await page.getByPlaceholder("Assignment title").fill(title);
		await page.getByPlaceholder(/What should students do/).fill("Draft body text");

		await page.keyboard.press("Escape");
		await expect(page.getByPlaceholder("Assignment title")).toBeHidden();

		const stored = await page.evaluate(
			(key) => JSON.parse(localStorage.getItem(key) || "null"),
			await draftKey(page)
		);
		expect(stored?.draft?.title).toBe(title);
		expect(stored?.draft?.description).toBe("Draft body text");

		await page.getByRole("button", { name: "New Assignment" }).click();
		await expect(page.getByPlaceholder("Assignment title")).toHaveValue(title);
		await expect(page.getByPlaceholder(/What should students do/)).toHaveValue(
			"Draft body text"
		);

		await page.evaluate((key) => localStorage.removeItem(key), await draftKey(page));
	});

	test("clears the localStorage draft after a successful create", async ({ page }) => {
		const title = `${TEST_ASSIGNMENT_PREFIX} ClearDraft ${Date.now()}`;
		await page.goto("/dashboard/faculty/assignments");
		await page.getByRole("button", { name: "New Assignment" }).click();

		await page.getByPlaceholder("Assignment title").fill(title);
		await page
			.getByRole("combobox")
			.filter({ hasText: /Select a cohort|No cohort/ })
			.click();
		await page.getByRole("listbox").waitFor();
		await page.keyboard.type(cohort.name);
		await page.keyboard.press("Enter");
		await fillDateTime(page, "Due Date", "2030-02-02 09:00:00");
		await page.getByRole("combobox").filter({ hasText: "Save as draft" }).click();
		await page.getByRole("option", { name: "Publish now" }).click();
		await page.getByRole("button", { name: "Create Assignment" }).click();

		await expect(page.locator(LIST_ROW, { hasText: title })).toBeVisible();
		const stored = await page.evaluate(
			(key) => localStorage.getItem(key),
			await draftKey(page)
		);
		expect(stored).toBeNull();
	});

	test("saves a draft with a quarter back to no quarter", async ({ page, request }) => {
		const quarter = await createDoc<{ name: string }>(request, "CS17 Quarter", {
			quarter_name: `E2E Quarter ${Date.now()}`,
		});
		const draft = await createTestAssignment(request, {
			cohort: cohort.name,
			isPublished: false,
		});
		await updateDoc(request, "CS17 Assignment", draft.name, { quarter: quarter.name });

		await page.goto("/dashboard/faculty/assignments");
		await page.getByRole("button", { name: /^Drafts/ }).click();
		await page.getByRole("button", { name: draft.title, exact: true }).click();
		await page.getByRole("combobox").filter({ hasText: quarter.name }).click();
		await page.getByRole("option", { name: "No quarter" }).click();
		await page.getByRole("button", { name: "Save Assignment" }).click();
		await expect(page.getByText("Assignment saved")).toBeVisible();

		const saved = await getDoc<{ quarter: string | null }>(
			request,
			"CS17 Assignment",
			draft.name
		);
		expect(saved.quarter).toBeFalsy();

		await deleteDoc(request, "CS17 Quarter", quarter.name);
	});

	test("keeps the schedule of a draft that was scheduled after the list loaded", async ({
		page,
		request,
	}) => {
		const draft = await createTestAssignment(request, {
			cohort: cohort.name,
			isPublished: false,
		});

		await page.goto("/dashboard/faculty/assignments");
		await page.getByRole("button", { name: /^Drafts/ }).click();
		await updateDoc(request, "CS17 Assignment", draft.name, {
			publish_on: "2030-01-05 09:30:00",
		});
		await page.getByRole("button", { name: draft.title, exact: true }).click();
		await page.getByPlaceholder("Assignment title").fill(`${draft.title} edited`);
		await page.getByRole("button", { name: "Save Assignment" }).click();
		await expect(page.getByText("Assignment saved")).toBeVisible();

		const saved = await getDoc<{ publish_on: string | null }>(
			request,
			"CS17 Assignment",
			draft.name
		);
		expect(saved.publish_on).toBe("2030-01-05 09:30:00");
	});

	test("keeps the schedule of an assignment edited from its row", async ({ page, request }) => {
		const scheduled = await createTestAssignment(request, {
			cohort: cohort.name,
			isPublished: false,
		});
		await updateDoc(request, "CS17 Assignment", scheduled.name, {
			publish_on: "2030-01-05 09:30:00",
		});

		await page.goto("/dashboard/faculty/assignments");
		await page.getByRole("button", { name: `Edit ${scheduled.title}` }).click();
		await page.getByPlaceholder("Assignment title").fill(`${scheduled.title} edited`);
		await page.getByRole("button", { name: "Save Assignment" }).click();

		const row = page.locator(LIST_ROW, { hasText: `${scheduled.title} edited` });
		await expect(row.getByText("Scheduled", { exact: true })).toBeVisible();
		const saved = await getDoc<{ publish_on: string | null }>(
			request,
			"CS17 Assignment",
			scheduled.name
		);
		expect(saved.publish_on).toBe("2030-01-05 09:30:00");
	});

	test("shows no form when a draft cannot be loaded", async ({ page, request }) => {
		const draft = await createTestAssignment(request, {
			cohort: cohort.name,
			isPublished: false,
		});
		await page.route(/cs17_portal\.api\.get_assignment\?/, (route) =>
			route.fulfill({ status: 500 })
		);

		await page.goto("/dashboard/faculty/assignments");
		await page.getByRole("button", { name: /^Drafts/ }).click();
		await page.getByRole("button", { name: draft.title, exact: true }).click();

		await expect(page.getByText("Could not load this draft")).toBeVisible();
		await expect(page.getByRole("button", { name: "Save Assignment" })).toHaveCount(0);
	});

	test("keeps a new assignment empty when a closed draft finishes loading", async ({
		page,
		request,
	}) => {
		const draft = await createTestAssignment(request, {
			cohort: cohort.name,
			isPublished: false,
		});
		let answerDraft = () => {};
		const newAssignmentOpened = new Promise<void>((resolve) => (answerDraft = resolve));
		await page.route(/cs17_portal\.api\.get_assignment\?/, async (route) => {
			await newAssignmentOpened;
			await route.fallback();
		});

		await page.goto("/dashboard/faculty/assignments");
		await page.evaluate((key) => localStorage.removeItem(key), await draftKey(page));
		await page.getByRole("button", { name: /^Drafts/ }).click();
		await page.getByRole("button", { name: draft.title, exact: true }).click();
		await expect(page.getByRole("dialog")).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(page.getByRole("dialog")).toBeHidden();
		await page.getByRole("button", { name: "New Assignment" }).click();
		answerDraft();

		await expect(page.getByPlaceholder("Assignment title")).toHaveValue("");
	});

	test("opens a zip submission's files in the grading page", async ({ page, request }) => {
		const zip = await createTestAssignment(request, {
			cohort: cohort.name,
			submissionType: "ZIP",
		});
		const submission = await createTestSubmission(request, {
			assignment: zip.name,
			student: student.name,
		});
		const uploaded = await uploadFile(request, {
			fileName: "terminal-assignment.zip",
			content: Buffer.from(TERMINAL_ASSIGNMENT_ZIP, "base64"),
			doctype: "CS17 Assignment Submission",
			docname: submission.name,
		});
		await updateDoc(request, "CS17 Assignment Submission", submission.name, {
			submission_document: uploaded.file_url,
		});

		await page.goto(`/dashboard/faculty/assignments/${zip.name}`);
		const row = page.locator(LIST_ROW, { hasText: student.full_name! });
		await row.getByRole("button", { name: "Preview", exact: true }).click();

		await expect(page).toHaveURL(new RegExp(`/faculty/submissions/${submission.name}$`));
		await expect(
			page.getByRole("treeitem", { name: "history.txt", exact: true })
		).toBeVisible();
		await expect(page.getByText("cat README.txt")).toBeVisible();
	});

	test("previews a Scratch submission in the read-only editor", async ({ page, request }) => {
		const scratch = await createTestAssignment(request, {
			cohort: cohort.name,
			submissionType: "Scratch",
		});
		const submission = await createTestSubmission(request, {
			assignment: scratch.name,
			student: student.name,
		});
		const uploaded = await uploadFile(request, {
			fileName: "project.sb3",
			content: fs.readFileSync("cs17_portal/public/scratch/sample.sb3"),
			doctype: "CS17 Assignment Submission",
			docname: submission.name,
		});
		await updateDoc(request, "CS17 Assignment Submission", submission.name, {
			submission_document: uploaded.file_url,
		});

		await page.goto(`/dashboard/faculty/assignments/${scratch.name}`);
		const row = page.locator(LIST_ROW, { hasText: student.full_name! });
		await row.getByRole("button", { name: "Preview", exact: true }).click();

		await expect(page.getByTitle("Scratch project player")).toBeVisible();
		// The file fallback is a `link` Button, so it renders as an anchor.
		await expect(page.getByRole("link", { name: "Open file" })).toHaveCount(0);

		const frame = page.getByTitle("Scratch project player").contentFrame();
		await expect(frame.locator("#cs17-readonly-style")).toBeAttached();
		const state = await frame.locator("html").evaluate(() => {
			const hidden = (sel: string) => {
				const el = document.querySelector(sel) as HTMLElement | null;
				return !el || getComputedStyle(el).display === "none";
			};
			const pe = (sel: string) => {
				const el = document.querySelector(sel);
				return el ? getComputedStyle(el).pointerEvents : "missing";
			};
			return {
				menuBarHidden: hidden('[class*="menu-bar_menu-bar_"]'),
				tabsHidden: hidden('[class*="gui_tab-list_"]'),
				spritePaneHidden: hidden('[class*="target-pane_target-pane_"]'),
				findHidden: hidden(".sa-find-bar"),
				paletteHidden: hidden(".blocklyToolboxDiv"),
				scrollbarHidden: hidden(".blocklyScrollbarVertical"),
				blockCanvas: pe(".blocklyBlockCanvas"),
				greenFlag: pe('[class*="green-flag_green-flag_"]'),
			};
		});
		expect(state.menuBarHidden).toBe(true);
		expect(state.tabsHidden).toBe(true);
		expect(state.spritePaneHidden).toBe(true);
		expect(state.findHidden).toBe(true);
		expect(state.paletteHidden).toBe(true);
		expect(state.scrollbarHidden).toBe(true);
		expect(state.blockCanvas).toBe("none");
		expect(state.greenFlag).not.toBe("none");
	});

	test("keeps a Scratch preview hidden until the editor is read-only", async ({
		page,
		request,
	}) => {
		const scratch = await createTestAssignment(request, {
			cohort: cohort.name,
			submissionType: "Scratch",
		});
		const submission = await createTestSubmission(request, {
			assignment: scratch.name,
			student: student.name,
		});
		const uploaded = await uploadFile(request, {
			fileName: "project.sb3",
			content: fs.readFileSync("cs17_portal/public/scratch/sample.sb3"),
			doctype: "CS17 Assignment Submission",
			docname: submission.name,
		});
		await updateDoc(request, "CS17 Assignment Submission", submission.name, {
			submission_document: uploaded.file_url,
		});

		let releaseBlocks = () => {};
		const blocksReleased = new Promise<void>((resolve) => {
			releaseBlocks = resolve;
		});
		await page.route("**/scratch/js/pentapod/sb.*.js", async (route) => {
			await blocksReleased;
			await route.continue();
		});
		await page.goto(`/dashboard/faculty/assignments/${scratch.name}`);
		const row = page.locator(LIST_ROW, { hasText: student.full_name! });
		await row.getByRole("button", { name: "Preview", exact: true }).click();

		const player = page.getByTitle("Scratch project player");
		const editor = player.contentFrame();
		const costumes = editor.getByText("Costumes", { exact: true });
		await expect(costumes).toBeAttached();
		await expect(player).toBeHidden();
		await costumes.click({ force: true });

		releaseBlocks();
		await expect(player).toBeVisible();
		await expect(editor.locator(".blocklySvg")).toBeVisible();
	});

	test("offers a retry when a Scratch submission's project fails to load", async ({
		page,
		request,
	}) => {
		const scratch = await createTestAssignment(request, {
			cohort: cohort.name,
			submissionType: "Scratch",
		});
		const submission = await createTestSubmission(request, {
			assignment: scratch.name,
			student: student.name,
		});
		const uploaded = await uploadFile(request, {
			fileName: "project.sb3",
			content: fs.readFileSync("cs17_portal/public/scratch/sample.sb3"),
			doctype: "CS17 Assignment Submission",
			docname: submission.name,
		});
		await updateDoc(request, "CS17 Assignment Submission", submission.name, {
			submission_document: uploaded.file_url,
		});

		await page.route(
			(url) => url.href.includes("get_submission_project"),
			(route) => route.fulfill({ status: 500 }),
			{ times: 1 }
		);
		await page.goto(`/dashboard/faculty/submissions/${submission.name}`);

		await page.getByRole("button", { name: "Try again" }).click();
		await expect(page.getByTitle("Scratch project player")).toBeVisible();
	});

	test("grades a submission and publishes the grade", async ({ page }) => {
		await page.goto("/dashboard/faculty/assignments");
		// The row title is a router link now, not a button.
		await page.getByRole("link", { name: graded.title, exact: true }).click();

		await expect(page).toHaveURL(new RegExp(`/faculty/assignments/${graded.name}$`));

		const row = page.locator(LIST_ROW, { hasText: student.full_name! });
		await row.getByRole("button", { name: "Grade", exact: true }).click();

		await page
			.getByRole("combobox")
			.filter({ hasText: /Select a grade|No grade/ })
			.click();
		await page.getByRole("option", { name: "A", exact: true }).click();
		await page.getByRole("combobox").filter({ hasText: "Save as draft" }).click();
		await page.getByRole("option", { name: "Publish now" }).click();
		await page.getByRole("button", { name: "Save grade" }).click();

		const grade = row.locator(LIST_CELL, { hasText: "Published" });
		await expect(grade).toBeVisible();
		await expect(grade.getByText("A", { exact: true })).toBeVisible();
	});

	test("publishes a grade with no letter from the grade dialog", async ({ page, request }) => {
		const assignment = await createTestAssignment(request, {
			cohort: cohort.name,
			assignmentType: "Graded",
		});
		await createTestSubmission(request, {
			assignment: assignment.name,
			student: student.name,
		});
		await page.goto(`/dashboard/faculty/assignments/${assignment.name}`);

		const row = page.locator(LIST_ROW, { hasText: student.full_name! });
		await row.getByRole("button", { name: "Grade", exact: true }).click();
		await page.getByRole("combobox").filter({ hasText: "Save as draft" }).click();
		await page.getByRole("option", { name: "Publish now" }).click();
		await page.getByRole("button", { name: "Save grade" }).click();

		const grade = row.locator(LIST_CELL, { hasText: "Published" });
		await expect(grade.getByText("—", { exact: true })).toBeVisible();
	});

	test.describe("a marks assignment", () => {
		let defaultScale: TestDefaultScale;
		let marked: CS17Assignment;
		let markedSubmission: CS17Submission;

		test.beforeAll(async ({ request }) => {
			defaultScale = await createTestDefaultScale(request);
			marked = await createTestAssignment(request, {
				cohort: cohort.name,
				assignmentType: "Graded",
			});
			await updateDoc(request, "CS17 Assignment", marked.name, {
				remarks: "Marks",
				max_marks: 20,
			});
			markedSubmission = await createTestSubmission(request, {
				assignment: marked.name,
				student: student.name,
			});
		});

		test.afterAll(async ({ request }) => {
			await cleanupTestDefaultScale(request, defaultScale);
		});

		test("shows the letter the marks get and saves it with the grade", async ({ page }) => {
			await page.goto(`/dashboard/faculty/assignments/${marked.name}`);
			const row = page.locator(LIST_ROW, { hasText: student.full_name! });
			await row.getByRole("button", { name: "Grade", exact: true }).click();

			await page.getByLabel("Marks (out of 20)").fill("15");
			await expect(page.getByText("Grade B", { exact: true })).toBeVisible();
			await page.getByRole("button", { name: "Save grade" }).click();

			await expect(row.getByText("B · 15 / 20", { exact: true })).toBeVisible();
		});

		test("offers no grade form when the saved grade cannot be read", async ({ page }) => {
			await page.route(
				(url) => url.href.includes("get_submission_grade"),
				(route) => route.fulfill({ status: 500 })
			);
			await page.goto(`/dashboard/faculty/submissions/${markedSubmission.name}`);

			await expect(page.getByText("Could not load the grade")).toBeVisible();
			await expect(page.getByRole("button", { name: "Save grade" })).toHaveCount(0);
		});

		test("shows no empty line while the submitted file is looked up", async ({ page }) => {
			let release = () => {};
			const held = new Promise<void>((resolve) => {
				release = resolve;
			});
			await page.route(
				(url) => url.href.includes("get_assignment_submissions"),
				async (route) => {
					await held;
					await route.continue();
				}
			);
			await page.goto(`/dashboard/faculty/submissions/${markedSubmission.name}`);

			await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible();
			await expect(page.getByText("No submitted file.")).toHaveCount(0);

			const answered = page.waitForResponse(/get_assignment_submissions/);
			release();
			await answered;
		});

		test("offers a retry when the submitted file cannot be read", async ({ page }) => {
			await page.route(
				(url) => url.href.includes("get_assignment_submissions"),
				(route) => route.fulfill({ status: 500 })
			);
			await page.goto(`/dashboard/faculty/submissions/${markedSubmission.name}`);

			await expect(page.getByText("Could not load the submitted file")).toBeVisible();
			await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
		});

		test("shows the update label after a save without a second read", async ({ page }) => {
			let reads = 0;
			await page.route(
				(url) => url.href.includes("get_submission_grade"),
				(route) =>
					++reads === 1
						? route.fulfill({ json: { data: null } })
						: route.fulfill({ status: 500 })
			);
			await page.goto(`/dashboard/faculty/submissions/${markedSubmission.name}`);

			await page.getByLabel("Marks obtained").fill("15");
			await page.getByRole("button", { name: "Save grade" }).click();

			await expect(page.getByRole("button", { name: "Update grade" })).toBeVisible();
			expect(reads).toBe(1);
		});
	});

	test("offers a retry when a Scratch preview fails to load", async ({ page, request }) => {
		const scratch = await createTestAssignment(request, {
			cohort: cohort.name,
			submissionType: "Scratch",
		});
		const submission = await createTestSubmission(request, {
			assignment: scratch.name,
			student: student.name,
		});
		const uploaded = await uploadFile(request, {
			fileName: "project.sb3",
			content: fs.readFileSync("cs17_portal/public/scratch/sample.sb3"),
			doctype: "CS17 Assignment Submission",
			docname: submission.name,
		});
		await updateDoc(request, "CS17 Assignment Submission", submission.name, {
			submission_document: uploaded.file_url,
		});

		await page.route(
			(url) => url.href.includes("get_submission_project"),
			(route) => route.fulfill({ status: 500 }),
			{ times: 1 }
		);
		await page.goto(`/dashboard/faculty/assignments/${scratch.name}`);
		const row = page.locator(LIST_ROW, { hasText: student.full_name! });
		await row.getByRole("button", { name: "Preview", exact: true }).click();

		await page.getByRole("button", { name: "Try again" }).click();
		await expect(page.getByTitle("Scratch project player")).toBeVisible();
	});

	test("publishes the draft grade of a selected submission", async ({ page, request }) => {
		const assignment = await createTestAssignment(request, {
			cohort: cohort.name,
			assignmentType: "Graded",
		});
		const submission = await createTestSubmission(request, {
			assignment: assignment.name,
			student: student.name,
		});
		await callMethod(request, "cs17_portal.api.grade_submission", {
			submission: submission.name,
			grade: "B",
			publish: "draft",
		});

		await page.goto(`/dashboard/faculty/assignments/${assignment.name}`);
		const row = page.locator(LIST_ROW, { hasText: student.full_name! });
		await row.getByRole("checkbox").click();
		await page.getByRole("button", { name: "Publish 1 grade" }).click();
		await page.getByRole("button", { name: "Confirm" }).click();

		await expect(row.locator(LIST_CELL, { hasText: "Published" })).toBeVisible();
	});

	test.describe("a submission assigned to the faculty", () => {
		let assigned: CS17Submission;

		test.beforeAll(async ({ request }) => {
			const faculty: TestFaculty = JSON.parse(
				fs.readFileSync("e2e/.auth/faculty-info.json", "utf-8")
			);
			const assignment = await createTestAssignment(request, {
				cohort: cohort.name,
				assignmentType: "Graded",
			});
			assigned = await createTestSubmission(request, {
				assignment: assignment.name,
				student: student.name,
			});
			await callMethod(request, "cs17_portal.api.assign_submission", {
				submission: assigned.name,
				assign_to: faculty.email,
			});
		});

		test("opens the grading page from the dashboard's Grade button", async ({ page }) => {
			await page.goto("/dashboard/faculty");
			await page.getByRole("link", { name: "Grade", exact: true }).first().click();

			await expect(page).toHaveURL(new RegExp(`/faculty/submissions/${assigned.name}$`));
		});

		test("goes back to the dashboard from the grading page", async ({ page }) => {
			await page.goto("/dashboard/faculty");
			await page.getByRole("link", { name: "Grade", exact: true }).first().click();
			await page.getByRole("button", { name: "Back", exact: true }).click();

			await expect(page).toHaveURL(/\/dashboard\/faculty$/);
		});
	});

	test('opens a grade whose scheduled time has passed on "Publish now"', async ({
		page,
		request,
	}) => {
		const assignment = await createTestAssignment(request, {
			cohort: cohort.name,
			assignmentType: "Graded",
		});
		const submission = await createTestSubmission(request, {
			assignment: assignment.name,
			student: student.name,
		});
		await createDoc(request, "CS17 Assignment Grade", {
			assignment: assignment.name,
			submission: submission.name,
			grade: "B",
			published_on: "2000-01-01 09:00:00",
		});

		await page.goto(`/dashboard/faculty/assignments/${assignment.name}`);
		const row = page.locator(LIST_ROW, { hasText: student.full_name! });
		await row.getByRole("button", { name: "Edit grade" }).click();

		await expect(page.getByRole("combobox").filter({ hasText: "Publish now" })).toBeVisible();
	});

	test('offers no "Schedule" on a published grade', async ({ page, request }) => {
		const assignment = await createTestAssignment(request, {
			cohort: cohort.name,
			assignmentType: "Graded",
		});
		const submission = await createTestSubmission(request, {
			assignment: assignment.name,
			student: student.name,
		});
		await callMethod(request, "cs17_portal.api.grade_submission", {
			submission: submission.name,
			grade: "B",
			publish: "now",
		});

		await page.goto(`/dashboard/faculty/assignments/${assignment.name}`);
		const row = page.locator(LIST_ROW, { hasText: student.full_name! });
		await row.getByRole("button", { name: "Edit grade" }).click();
		await page.getByRole("combobox").filter({ hasText: "Publish now" }).click();

		await expect(page.getByRole("option", { name: "Save as draft" })).toBeVisible();
		await expect(page.getByRole("option", { name: "Schedule" })).toHaveCount(0);
	});

	test("shows no form for a draft that went live at its scheduled time", async ({
		page,
		request,
	}) => {
		const draft = await createTestAssignment(request, {
			cohort: cohort.name,
			isPublished: false,
		});

		await page.goto("/dashboard/faculty/assignments");
		await page.getByRole("button", { name: /^Drafts/ }).click();
		await updateDoc(request, "CS17 Assignment", draft.name, {
			publish_on: "2000-01-01 09:00:00",
		});
		await page.getByRole("button", { name: draft.title, exact: true }).click();

		await expect(
			page.getByText("A published assignment can no longer be edited")
		).toBeVisible();
		await expect(page.getByRole("button", { name: "Save Assignment" })).toHaveCount(0);
	});

	test("clears max marks on a switch from Marks to Grade", async ({ page }) => {
		await page.goto("/dashboard/faculty/assignments");
		await page.getByRole("button", { name: "New Assignment" }).click();

		await page.getByRole("combobox").filter({ hasText: "Non-graded" }).click();
		await page.getByRole("option", { name: "Marks", exact: true }).click();
		await page.getByLabel("Max Marks").fill("20");
		await page.getByRole("combobox").filter({ hasText: "Marks" }).click();
		await page.getByRole("option", { name: "Grade", exact: true }).click();
		await page.getByRole("combobox").filter({ hasText: "Grade" }).click();
		await page.getByRole("option", { name: "Marks", exact: true }).click();

		await expect(page.getByLabel("Max Marks")).toHaveValue("");
	});

	test("shows no form for an announcement whose scheduled time has passed", async ({ page }) => {
		await page.route("**/cs17_portal.api.get_faculty_announcements*", (route) =>
			route.fulfill({
				json: {
					data: [
						{
							name: TEST_ANNOUNCEMENT_PREFIX,
							title: TEST_ANNOUNCEMENT_PREFIX,
							content: "Please read the handbook.",
							alert_variant: "info",
							cohort: null,
							is_dismissible: 1,
							is_published: 0,
							publish_on: "2000-01-01 09:00:00",
							can_edit: true,
						},
					],
				},
			})
		);

		await page.goto("/dashboard/faculty/announcements");
		await page.getByRole("button", { name: `Edit ${TEST_ANNOUNCEMENT_PREFIX}` }).click();

		await expect(
			page.getByText("A published announcement can no longer be edited")
		).toBeVisible();
		await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
	});

	test.describe("a faculty bound to a cohort", () => {
		let faculty: TestFaculty;

		test.beforeAll(async ({ request }) => {
			faculty = JSON.parse(fs.readFileSync("e2e/.auth/faculty-info.json", "utf-8"));
			await updateDoc(request, "CS17 Profile", faculty.profileName, {
				cohort: cohort.name,
			});
		});

		test.afterAll(async ({ request }) => {
			await updateDoc(request, "CS17 Profile", faculty.profileName, { cohort: null });
		});

		test("saves a new draft without picking a cohort", async ({ page }) => {
			const title = `${TEST_ASSIGNMENT_PREFIX} Bound ${Date.now()}`;
			await page.goto("/dashboard/faculty/assignments");
			await page.getByRole("button", { name: "New Assignment" }).click();
			await page.getByPlaceholder("Assignment title").fill(title);
			await page.getByRole("button", { name: "Create Assignment" }).click();

			await expect(page.getByText("Assignment created")).toBeVisible();
		});
	});

	test("opens a draft from its row", async ({ page, request }) => {
		const draft = await createTestAssignment(request, {
			cohort: cohort.name,
			isPublished: false,
		});

		await page.goto("/dashboard/faculty/assignments");
		await page.getByRole("button", { name: `Edit ${draft.title}` }).click();

		await expect(page.getByPlaceholder("Assignment title")).toHaveValue(draft.title);
	});
});
