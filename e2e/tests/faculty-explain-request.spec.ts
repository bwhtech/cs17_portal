import { APIRequestContext, expect, test } from "@playwright/test";
import {
	CS17Cohort,
	CS17Submission,
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
import { callMethod, deleteDoc, getList } from "../helpers/frappe";

let cohort: CS17Cohort;
let student: TestStudent;
const submissions: string[] = [];

async function submitWork(request: APIRequestContext): Promise<CS17Submission> {
	const assignment = await createTestAssignment(request, { cohort: cohort.name });
	const submission = await createTestSubmission(request, {
		assignment: assignment.name,
		student: student.profileName,
	});
	submissions.push(submission.name);
	return submission;
}

test.describe("Asking a student to explain their code", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		student = await createTestStudent(request, cohort.name);
	});

	test.afterAll(async ({ request }) => {
		const requests = await getList<{ name: string }>(request, "CS17 Explanation Request", {
			fields: ["name"],
			filters: { submission: ["in", submissions] },
		});
		for (const explanationRequest of requests) {
			await deleteDoc(request, "CS17 Explanation Request", explanationRequest.name);
		}
		await cleanupTestSubmissions(request, cohort.name);
		await cleanupTestAssignments(request, cohort.name);
		await deleteTestProfile(request, student.profileName);
		await deleteTestUser(request, student.email);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("asks for an explanation from the grading page", async ({ page, request }) => {
		const submission = await submitWork(request);

		await page.goto(`/dashboard/faculty/submissions/${submission.name}`);
		await page.getByRole("button", { name: "Ask to explain", exact: true }).click();
		const dialog = page.getByRole("dialog");
		await dialog.getByLabel("Question", { exact: true }).fill("Why does the loop start at 1?");
		await dialog.getByRole("button", { name: "Send", exact: true }).click();
		await expect(page.getByText("Explanation requested")).toBeVisible();

		await page.reload();
		await expect(page.getByText("Explanation requested")).toBeVisible();
	});

	test("plays the voice note the student sent", async ({ browser, page, request }) => {
		const submission = await submitWork(request);
		await callMethod(request, "cs17_portal.explanations.request_explanation", {
			submission: submission.name,
			question: "Why does the loop start at 1?",
		});
		const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
		await context.addInitScript(() => {
			Object.defineProperty(navigator, "mediaDevices", {
				value: {
					getUserMedia: async () => {
						const audio = new AudioContext();
						const oscillator = audio.createOscillator();
						const destination = audio.createMediaStreamDestination();
						oscillator.connect(destination);
						oscillator.start();
						return destination.stream;
					},
				},
			});
		});
		await context.request.post("/api/method/login", {
			form: { usr: student.email, pwd: student.password },
		});
		const studentPage = await context.newPage();

		await studentPage.goto(`/dashboard/assignments/${submission.assignment}/submission`);
		await expect(studentPage.getByText("Why does the loop start at 1?")).toBeVisible();
		await studentPage.getByRole("button", { name: "Record", exact: true }).click();
		await expect(studentPage.getByRole("timer", { name: "Recording time" })).toContainText(
			"0:01"
		);
		await studentPage.getByRole("button", { name: "Stop", exact: true }).click();
		await studentPage.getByRole("button", { name: "Send", exact: true }).click();
		await expect(studentPage.getByText(/^Sent /)).toBeVisible();
		await context.close();

		await page.goto(`/dashboard/faculty/submissions/${submission.name}`);
		await expect(page.locator("audio")).toHaveAttribute("src", /^data:audio\//);
	});
});
