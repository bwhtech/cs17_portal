import * as fs from "fs";
import { test, expect, Page } from "@playwright/test";
import {
	CS17Assignment,
	cleanupTestAssignments,
	cleanupTestSubmissions,
	createTestAssignment,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { getList } from "../helpers/frappe";

interface StudentInfo {
	email: string;
	cohort: string;
	cohortName: string;
	profileName: string;
}

const SUBMIT_METHOD =
	"cs17_portal.cs17_portal.doctype.cs17_assignment_submission.cs17_assignment_submission.submit_assignment";

async function submitAsStudent(page: Page, assignment: string, fileUrl: string) {
	await page.goto("/dashboard");
	await page.waitForFunction(
		() =>
			(window as any).csrf_token !== undefined ||
			(window as any).frappe?.csrf_token !== undefined,
		{ timeout: 15000 },
	);
	return page.evaluate(
		async ({ assignment, fileUrl, method }) => {
			const token =
				(window as any).csrf_token ?? (window as any).frappe?.csrf_token;
			const resp = await fetch(`/api/method/${method}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Frappe-CSRF-Token": token,
				},
				body: JSON.stringify({ assignment, file_url: fileUrl }),
			});
			return { ok: resp.ok, status: resp.status };
		},
		{ assignment, fileUrl, method: SUBMIT_METHOD },
	);
}

test.describe("Student submission types", () => {
	let pdf: CS17Assignment;
	let url: CS17Assignment;
	let anyType: CS17Assignment;
	let uiPdf: CS17Assignment;
	let uiUrl: CS17Assignment;

	test.beforeAll(async ({ request }) => {
		const studentInfo: StudentInfo = JSON.parse(
			fs.readFileSync("e2e/.auth/student-info.json", "utf-8"),
		);
		await ensureSessionFaculty(request);
		const cohort = studentInfo.cohort;
		pdf = await createTestAssignment(request, { cohort, submissionType: "PDF" });
		url = await createTestAssignment(request, { cohort, submissionType: "URL" });
		anyType = await createTestAssignment(request, { cohort, submissionType: "Any" });
		uiPdf = await createTestAssignment(request, {
			cohort,
			submissionType: "PDF",
			title: `E2E Assignment UI-PDF ${Date.now()}`,
		});
		uiUrl = await createTestAssignment(request, {
			cohort,
			submissionType: "URL",
			title: `E2E Assignment UI-URL ${Date.now()}`,
		});
	});

	test.afterAll(async ({ request }) => {
		// Cohort and student belong to the student-setup project; leave them.
		await cleanupTestSubmissions(request);
		await cleanupTestAssignments(request);
	});

	test("rejects a non-PDF and accepts a PDF for a PDF assignment", async ({ page }) => {
		const bad = await submitAsStudent(page, pdf.name, "/files/report.png");
		expect(bad.ok).toBeFalsy();

		const good = await submitAsStudent(page, pdf.name, "/files/report.pdf");
		expect(good.ok).toBeTruthy();
	});

	test("stores a URL submission in submission_url, not submission_document", async ({
		page,
		request,
	}) => {
		const link = "https://github.com/student/work";
		const result = await submitAsStudent(page, url.name, link);
		expect(result.ok).toBeTruthy();

		const subs = await getList<{
			name: string;
			submission_document?: string;
			submission_url?: string;
		}>(request, "CS17 Assignment Submission", {
			fields: ["name", "submission_document", "submission_url"],
			filters: { assignment: url.name },
			limit: 1,
		});
		expect(subs[0].submission_url).toBe(link);
		expect(subs[0].submission_document).toBeFalsy();
	});

	test("rejects a non-URL value for a URL assignment", async ({ page }) => {
		const bad = await submitAsStudent(page, url.name, "/files/work.pdf");
		expect(bad.ok).toBeFalsy();
	});

	test("accepts any file for an Any assignment", async ({ page, request }) => {
		const result = await submitAsStudent(page, anyType.name, "/files/notes.txt");
		expect(result.ok).toBeTruthy();

		const subs = await getList<{ name: string; submission_document?: string }>(
			request,
			"CS17 Assignment Submission",
			{
				fields: ["name", "submission_document"],
				filters: { assignment: anyType.name },
				limit: 1,
			},
		);
		expect(subs[0].submission_document).toBe("/files/notes.txt");
	});

	test("submit dialog adapts to the assignment type", async ({ page }) => {
		await page.goto("/dashboard/assignments");

		const pdfRow = page.locator("tr", { hasText: uiPdf.title });
		await pdfRow.getByRole("button", { name: "Submit" }).click();
		await expect(page.getByText("Upload a PDF only")).toBeVisible();
		await expect(page.locator('input[type="file"]')).toHaveAttribute(
			"accept",
			"application/pdf",
		);
		await page.keyboard.press("Escape");

		const urlRow = page.locator("tr", { hasText: uiUrl.title });
		await urlRow.getByRole("button", { name: "Submit" }).click();
		await expect(page.getByText("Paste a URL only")).toBeVisible();
		await expect(page.locator('input[type="url"]')).toBeVisible();
	});
});
