import { APIRequestContext } from "@playwright/test";
import { test, expect } from "@playwright/test";
import {
	CS17Assignment,
	CS17Cohort,
	CS17Profile,
	TEST_ASSIGNMENT_PREFIX,
	cleanupTestAssignments,
	cleanupTestGrades,
	cleanupTestSubmissions,
	createTestCohort,
	createTestProfile,
	createTestSubmission,
	deleteTestProfile,
	ensureSessionFaculty,
} from "../helpers/cs17";
import {
	callGetMethod,
	callMethod,
	deleteDoc,
	docExists,
	getDoc,
} from "../helpers/frappe";

const CREATE = "cs17_portal.api.create_assignment";
const UPDATE = "cs17_portal.api.update_assignment";
const DELETE = "cs17_portal.api.delete_assignment";
const PUBLISH = "cs17_portal.api.publish_assignment";
const GRADE = "cs17_portal.api.grade_submission";
const LIST = "cs17_portal.api.get_faculty_assignments";
const SUBMISSIONS = "cs17_portal.api.get_assignment_submissions";

interface Grade {
	grade: string | null;
	marks_obtained: number | null;
	is_published: number;
}

interface SubmissionsResult {
	assignment: { name: string; title: string };
	submissions: Array<{ name: string; grade: Grade | null }>;
}

interface AssignmentRow extends CS17Assignment {
	submission_count: number;
}

let cohort: CS17Cohort;
let student: CS17Profile;
let counter = 0;

function assignmentTitle(): string {
	return `${TEST_ASSIGNMENT_PREFIX} Faculty ${Date.now()}-${counter++}`;
}

function createAssignment(
	request: APIRequestContext,
	overrides: Record<string, unknown> = {},
): Promise<string> {
	return callMethod<string>(request, CREATE, {
		title: assignmentTitle(),
		cohort: cohort.name,
		due_date: "2030-01-01 00:00:00",
		...overrides,
	});
}

function gradableAssignment(request: APIRequestContext): Promise<string> {
	return createAssignment(request, { assignment_type: "Graded", remarks: "Grade" });
}

test.describe("Faculty assignment management", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		student = await createTestProfile(request, {
			profileType: "Student",
			cohort: cohort.name,
		});
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestGrades(request);
		await cleanupTestSubmissions(request);
		await cleanupTestAssignments(request);
		await deleteTestProfile(request, student.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("saves a draft assignment that stays unpublished", async ({ request }) => {
		const name = await createAssignment(request, { publish: "draft" });
		expect(name.startsWith("NOT-GRADED-")).toBeTruthy();

		const doc = await getDoc<CS17Assignment>(request, "CS17 Assignment", name);
		expect(doc.is_published).toBe(0);
	});

	test("publishes an assignment immediately", async ({ request }) => {
		const name = await createAssignment(request, { publish: "now" });
		const doc = await getDoc<CS17Assignment>(request, "CS17 Assignment", name);
		expect(doc.is_published).toBe(1);
	});

	test("schedules a future publish and rejects a missing date", async ({ request }) => {
		const name = await createAssignment(request, {
			publish: "schedule",
			publish_on: "2030-06-01 09:00:00",
		});
		const doc = await getDoc<CS17Assignment & { publish_on: string }>(
			request,
			"CS17 Assignment",
			name,
		);
		expect(doc.is_published).toBe(0);
		expect(doc.publish_on).toContain("2030-06-01");

		await expect(createAssignment(request, { publish: "schedule" })).rejects.toThrow();
	});

	test("publishes an existing draft now", async ({ request }) => {
		const name = await createAssignment(request, { publish: "draft" });
		await callMethod(request, PUBLISH, { assignment: name, publish: "now" });

		const doc = await getDoc<CS17Assignment>(request, "CS17 Assignment", name);
		expect(doc.is_published).toBe(1);
	});

	test("schedules an existing draft for later", async ({ request }) => {
		const name = await createAssignment(request, { publish: "draft" });
		await callMethod(request, PUBLISH, {
			assignment: name,
			publish: "schedule",
			publish_on: "2030-07-01 09:00:00",
		});

		const doc = await getDoc<CS17Assignment & { publish_on: string }>(
			request,
			"CS17 Assignment",
			name,
		);
		expect(doc.is_published).toBe(0);
		expect(doc.publish_on).toContain("2030-07-01");
	});

	test("saves a draft with only a title (cohort/due date optional)", async ({ request }) => {
		const name = await callMethod<string>(request, CREATE, {
			title: assignmentTitle(),
			cohort: "",
			due_date: "",
			publish: "draft",
		});
		const doc = await getDoc<CS17Assignment>(request, "CS17 Assignment", name);
		expect(doc.is_published).toBe(0);
	});

	test("refuses to publish a draft missing cohort or due date", async ({ request }) => {
		const name = await callMethod<string>(request, CREATE, {
			title: assignmentTitle(),
			cohort: "",
			due_date: "",
			publish: "draft",
		});
		await expect(
			callMethod(request, PUBLISH, { assignment: name, publish: "now" }),
		).rejects.toThrow();
	});

	test("get_assignment returns editable fields for a draft", async ({ request }) => {
		const name = await createAssignment(request, {
			publish: "draft",
			assignment_type: "Graded",
			remarks: "Marks",
			max_marks: 20,
		});

		const doc = await callGetMethod<{
			name: string;
			assignment_type: string;
			remarks: string;
			max_marks: number;
		}>(request, "cs17_portal.api.get_assignment", { assignment: name });
		expect(doc.name).toBe(name);
		expect(doc.assignment_type).toBe("Graded");
		expect(doc.remarks).toBe("Marks");
		expect(doc.max_marks).toBe(20);
	});

	test("continues a draft: updates fields and publishes it", async ({ request }) => {
		const name = await createAssignment(request, { publish: "draft" });
		const newTitle = `${TEST_ASSIGNMENT_PREFIX} Continued ${Date.now()}`;
		await callMethod(request, UPDATE, {
			assignment: name,
			title: newTitle,
			cohort: cohort.name,
			due_date: "2030-02-02 00:00:00",
			publish: "now",
		});

		const doc = await getDoc<CS17Assignment & { title: string }>(
			request,
			"CS17 Assignment",
			name,
		);
		expect(doc.title).toBe(newTitle);
		expect(doc.is_published).toBe(1);
	});

	test("deletes a draft assignment", async ({ request }) => {
		const name = await createAssignment(request, { publish: "draft" });
		await callMethod(request, DELETE, { assignment: name });
		expect(await docExists(request, "CS17 Assignment", name)).toBe(false);
	});

	test("refuses to delete an assignment that has submissions", async ({ request }) => {
		const assignment = await createAssignment(request, { publish: "now" });
		await createTestSubmission(request, { assignment, student: student.name });

		await expect(
			callMethod(request, DELETE, { assignment }),
		).rejects.toThrow();
		expect(await docExists(request, "CS17 Assignment", assignment)).toBe(true);
	});

	test("names graded assignments with the graded series", async ({ request }) => {
		const name = await gradableAssignment(request);
		expect(name.startsWith("GRADED-")).toBeTruthy();
	});

	test("lists cohort assignments with submission counts", async ({ request }) => {
		const withSubmission = await gradableAssignment(request);
		const empty = await createAssignment(request, { publish: "now" });
		await createTestSubmission(request, {
			assignment: withSubmission,
			student: student.name,
		});

		const assignments = await callGetMethod<AssignmentRow[]>(request, LIST, {
			cohort: cohort.name,
		});
		const counted = assignments.find((a) => a.name === withSubmission);
		const uncounted = assignments.find((a) => a.name === empty);
		expect(counted?.submission_count).toBe(1);
		expect(uncounted?.submission_count).toBe(0);
	});

	test("publishes a grade immediately", async ({ request }) => {
		const assignment = await gradableAssignment(request);
		const submission = await createTestSubmission(request, {
			assignment,
			student: student.name,
		});

		const before = await callGetMethod<SubmissionsResult>(request, SUBMISSIONS, {
			assignment,
		});
		expect(before.submissions[0].grade).toBeFalsy();

		await callMethod(request, GRADE, {
			submission: submission.name,
			grade: "A",
			publish: "now",
		});

		const after = await callGetMethod<SubmissionsResult>(request, SUBMISSIONS, {
			assignment,
		});
		const row = after.submissions.find((s) => s.name === submission.name);
		expect(row?.grade?.grade).toBe("A");
		expect(row?.grade?.is_published).toBe(1);
	});

	test("publishes an existing draft grade", async ({ request }) => {
		const assignment = await gradableAssignment(request);
		const submission = await createTestSubmission(request, {
			assignment,
			student: student.name,
		});

		await callMethod(request, GRADE, {
			submission: submission.name,
			grade: "C",
			publish: "draft",
		});
		await callMethod(request, GRADE, {
			submission: submission.name,
			grade: "C",
			publish: "now",
		});

		const result = await callGetMethod<SubmissionsResult>(request, SUBMISSIONS, {
			assignment,
		});
		const row = result.submissions.find((s) => s.name === submission.name);
		expect(row?.grade?.grade).toBe("C");
		expect(row?.grade?.is_published).toBe(1);
	});

	test("saves a grade as an unpublished draft", async ({ request }) => {
		const assignment = await gradableAssignment(request);
		const submission = await createTestSubmission(request, {
			assignment,
			student: student.name,
		});

		await callMethod(request, GRADE, {
			submission: submission.name,
			grade: "B",
			publish: "draft",
		});

		const result = await callGetMethod<SubmissionsResult>(request, SUBMISSIONS, {
			assignment,
		});
		const row = result.submissions.find((s) => s.name === submission.name);
		expect(row?.grade?.grade).toBe("B");
		expect(row?.grade?.is_published).toBe(0);
	});
});
