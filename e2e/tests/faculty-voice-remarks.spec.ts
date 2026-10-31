import { test, expect } from "@playwright/test";
import {
	CS17Cohort,
	CS17Profile,
	cleanupTestAssignments,
	cleanupTestGrades,
	cleanupTestSubmissions,
	createTestAssignment,
	createTestCohort,
	createTestProfile,
	createTestSubmission,
	deleteTestProfile,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { callMethod, deleteDoc } from "../helpers/frappe";

let cohort: CS17Cohort;
let student: CS17Profile;

test.describe("Voice remarks on the grading page", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		student = await createTestProfile(request, {
			profileType: "Student",
			cohort: cohort.name,
		});
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestGrades(request, cohort.name);
		await cleanupTestSubmissions(request, cohort.name);
		await cleanupTestAssignments(request, cohort.name);
		await deleteTestProfile(request, student.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test.beforeEach(async ({ context }) => {
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
	});

	test("saves a voice note as the remarks", async ({ page, request }) => {
		const assignment = await createTestAssignment(request, { cohort: cohort.name });
		const submission = await createTestSubmission(request, {
			assignment: assignment.name,
			student: student.name,
		});

		await page.goto(`/dashboard/faculty/submissions/${submission.name}`);
		await page.getByRole("button", { name: "Record", exact: true }).click();
		await expect(page.getByRole("timer", { name: "Recording time" })).toContainText("0:01");
		await page.getByRole("button", { name: "Stop", exact: true }).click();
		await expect(page.getByRole("button", { name: "Delete voice note" })).toBeVisible();
		await page.getByRole("button", { name: "Save remarks" }).click();
		await expect(page.getByRole("button", { name: "Update remarks" })).toBeVisible();

		await page.reload();
		await expect(page.getByRole("button", { name: "Delete voice note" })).toBeVisible();
	});

	test("removes a saved voice note", async ({ page, request }) => {
		const assignment = await createTestAssignment(request, { cohort: cohort.name });
		const submission = await createTestSubmission(request, {
			assignment: assignment.name,
			student: student.name,
		});
		await callMethod(request, "cs17_portal.api.save_grade", {
			submission: submission.name,
			voice_remark: "data:audio/webm;codecs=opus;base64,R0tFQkE=",
		});

		await page.goto(`/dashboard/faculty/submissions/${submission.name}`);
		await page.getByRole("button", { name: "Delete voice note" }).click();
		await page.getByRole("textbox", { name: "Remarks" }).fill("Good use of loops.");
		await page.getByRole("button", { name: "Update remarks" }).click();
		await expect(page.getByText("Remarks saved.")).toBeVisible();

		await page.reload();
		await expect(page.getByRole("button", { name: "Record", exact: true })).toBeVisible();
	});
});
