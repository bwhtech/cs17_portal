import { APIRequestContext, Browser, BrowserContext, expect, test } from "@playwright/test";
import {
	CS17Assignment,
	CS17Cohort,
	CS17Profile,
	TestStudent,
	cleanupTestAssignments,
	cleanupTestSubmissions,
	createTestAssignment,
	createTestCohort,
	createTestStudent,
	createTestSubmission,
	deleteTestProfile,
	deleteTestUser,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { callMethod, deleteDoc, getDoc, getList, updateDoc } from "../helpers/frappe";

let cohort: CS17Cohort;
let author: TestStudent;
let reviewer: TestStudent;
let authorName: string;
let reviewerName: string;
const assignments: string[] = [];

async function closedAssignment(request: APIRequestContext): Promise<CS17Assignment> {
	const assignment = await createTestAssignment(request, {
		cohort: cohort.name,
		submissionType: "Python",
		dueDate: "2026-01-01 00:00:00",
	});
	assignments.push(assignment.name);
	for (const [student, code] of [
		[author, "print(*range(1, 6))\n"],
		[reviewer, "for number in range(1, 6):\n    print(number)\n"],
	] as const) {
		const submission = await createTestSubmission(request, {
			assignment: assignment.name,
			student: student.profileName,
		});
		await updateDoc(request, "CS17 Assignment Submission", submission.name, { code });
	}
	return assignment;
}

async function startedAssignment(request: APIRequestContext): Promise<CS17Assignment> {
	const assignment = await closedAssignment(request);
	await callMethod(request, "cs17_portal.peer_review.start_peer_review", {
		assignment: assignment.name,
	});
	return assignment;
}

async function logInAs(browser: Browser, student: TestStudent): Promise<BrowserContext> {
	const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
	await context.request.post("/api/method/login", {
		form: { usr: student.email, pwd: student.password },
	});
	return context;
}

test.describe("Peer review", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		author = await createTestStudent(request, cohort.name);
		reviewer = await createTestStudent(request, cohort.name);
		authorName = (await getDoc<CS17Profile>(request, "CS17 Profile", author.profileName))
			.full_name!;
		reviewerName = (await getDoc<CS17Profile>(request, "CS17 Profile", reviewer.profileName))
			.full_name!;
	});

	test.afterAll(async ({ request }) => {
		const reviews = await getList<{ name: string }>(request, "CS17 Peer Review", {
			fields: ["name"],
			filters: { assignment: ["in", assignments] },
		});
		for (const review of reviews) {
			await deleteDoc(request, "CS17 Peer Review", review.name);
		}
		await cleanupTestSubmissions(request, cohort.name);
		await cleanupTestAssignments(request, cohort.name);
		for (const student of [author, reviewer]) {
			await deleteTestProfile(request, student.profileName);
			await deleteTestUser(request, student.email);
		}
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("starts after the deadline and lists who reviews whom", async ({ page, request }) => {
		const assignment = await closedAssignment(request);

		await page.goto(`/dashboard/faculty/assignments/${assignment.name}`);
		await page.getByRole("button", { name: "Peer review", exact: true }).click();
		const dialog = page.getByRole("dialog", { name: "Peer review" });
		await dialog.getByRole("button", { name: "Start", exact: true }).click();

		await expect(page.getByText("Peer review started")).toBeVisible();
		await expect(dialog.getByRole("heading", { name: authorName })).toBeVisible();
		await expect(
			dialog.getByRole("button", { name: `Remove review by ${reviewerName}`, exact: true })
		).toBeVisible();
		await expect(dialog.getByText("Not written", { exact: true })).toHaveCount(2);
	});

	test("a student reviews a classmate's code without their name", async ({
		browser,
		request,
	}) => {
		const assignment = await startedAssignment(request);
		const context = await logInAs(browser, reviewer);
		const studentPage = await context.newPage();

		await studentPage.goto(`/dashboard/assignments/${assignment.name}/submission`);
		await studentPage.getByRole("button", { name: "Review", exact: true }).click();
		const dialog = studentPage.getByRole("dialog", { name: "Classmate 1" });
		await expect(dialog.locator(".cm-content")).toContainText("print(*range(1, 6))");
		await expect(dialog).not.toContainText(authorName);

		await dialog.getByRole("button", { name: "Send", exact: true }).click();
		await expect(dialog.getByText("Write at least 15 characters.")).toHaveCount(2);

		await dialog
			.getByRole("textbox", { name: /What works well/ })
			.fill("Short and easy to read.");
		await dialog
			.getByRole("textbox", { name: /One thing to improve/ })
			.fill("Say in a comment what the loop prints.");
		await dialog.getByRole("button", { name: "Send", exact: true }).click();

		await expect(studentPage.getByText("Review sent")).toBeVisible();
		await expect(studentPage.getByText("Sent", { exact: true })).toBeVisible();
		await context.close();
	});

	test("the author reads the reviews once faculty share them", async ({
		browser,
		page,
		request,
	}) => {
		const assignment = await startedAssignment(request);
		const reviews = await getList<{ name: string }>(request, "CS17 Peer Review", {
			fields: ["name"],
			filters: { assignment: assignment.name },
		});
		for (const review of reviews) {
			await updateDoc(request, "CS17 Peer Review", review.name, {
				strengths: "Short and easy to read.",
				improvement: "Say in a comment what the loop prints.",
				submitted_on: "2026-01-02 10:00:00",
			});
		}

		await page.goto(`/dashboard/faculty/assignments/${assignment.name}`);
		await page.getByRole("button", { name: "Peer review", exact: true }).click();
		const dialog = page.getByRole("dialog", { name: "Peer review" });
		await dialog
			.getByRole("button", { name: "Share reviews with students", exact: true })
			.click();
		await expect(page.getByText("Reviews shared")).toBeVisible();

		const context = await logInAs(browser, author);
		const authorPage = await context.newPage();
		await authorPage.goto(`/dashboard/assignments/${assignment.name}/submission`);
		await expect(authorPage.getByText("What your classmates said")).toBeVisible();
		await expect(authorPage.getByText("Say in a comment what the loop prints.")).toBeVisible();
		await expect(authorPage.locator("body")).not.toContainText(reviewerName);
		await context.close();
	});
});
