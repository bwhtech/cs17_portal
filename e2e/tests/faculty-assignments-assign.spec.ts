import { APIRequestContext } from "@playwright/test";
import { test, expect } from "@playwright/test";
import {
	CS17Cohort,
	CS17Profile,
	TEST_ASSIGNMENT_PREFIX,
	cleanupTestAssignments,
	cleanupTestSubmissions,
	createTestCohort,
	createTestProfile,
	createTestSubmission,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { callGetMethod, callMethod } from "../helpers/frappe";

const CREATE = "cs17_portal.api.create_assignment";
const ASSIGN = "cs17_portal.api.assign_submission";
const ASSIGN_MANY = "cs17_portal.api.assign_submissions";
const UNASSIGN = "cs17_portal.api.unassign_submission";
const ASSIGNED = "cs17_portal.api.get_assigned_submissions";
const MEMBERS = "cs17_portal.api.get_faculty_members";

// ensureSessionFaculty defaults to Administrator, so the API session is this user.
const SESSION_USER = "Administrator";

interface AssignedSubmission {
	name: string;
	assignment: string;
	full_name: string;
}

interface FacultyMember {
	user: string;
	full_name: string;
}

let cohort: CS17Cohort;
let student: CS17Profile;
let counter = 0;

async function seedSubmission(request: APIRequestContext): Promise<string> {
	const assignment = await callMethod<string>(request, CREATE, {
		title: `${TEST_ASSIGNMENT_PREFIX} Assign ${Date.now()}-${counter++}`,
		cohort: cohort.name,
		due_date: "2030-01-01 00:00:00",
	});
	const submission = await createTestSubmission(request, {
		assignment,
		student: student.name,
	});
	return submission.name;
}

test.describe("Faculty submission assignment", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
		student = await createTestProfile(request, {
			profileType: "Student",
			cohort: cohort.name,
		});
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestSubmissions(request);
		await cleanupTestAssignments(request);
	});

	test("assigned submission surfaces in get_assigned_submissions", async ({ request }) => {
		const submission = await seedSubmission(request);
		await callMethod(request, ASSIGN, { submission, assign_to: SESSION_USER });

		const assigned = await callGetMethod<AssignedSubmission[]>(request, ASSIGNED, {
			limit: 20,
		});
		expect(assigned.some((row) => row.name === submission)).toBeTruthy();
	});

	test("unassign removes the submission from the queue", async ({ request }) => {
		const submission = await seedSubmission(request);
		await callMethod(request, ASSIGN, { submission, assign_to: SESSION_USER });
		await callMethod(request, UNASSIGN, { submission, assign_to: SESSION_USER });

		const assigned = await callGetMethod<AssignedSubmission[]>(request, ASSIGNED, {
			limit: 20,
		});
		expect(assigned.some((row) => row.name === submission)).toBeFalsy();
	});

	test("bulk assign surfaces every selected submission", async ({ request }) => {
		const first = await seedSubmission(request);
		const second = await seedSubmission(request);
		await callMethod(request, ASSIGN_MANY, {
			submissions: [first, second],
			assign_to: SESSION_USER,
		});

		const assigned = await callGetMethod<AssignedSubmission[]>(request, ASSIGNED, {
			limit: 50,
		});
		const names = assigned.map((row) => row.name);
		expect(names).toContain(first);
		expect(names).toContain(second);
	});

	test("get_faculty_members includes the session faculty", async ({ request }) => {
		const members = await callGetMethod<FacultyMember[]>(request, MEMBERS, {});
		expect(members.some((member) => member.user === SESSION_USER)).toBeTruthy();
	});
});
