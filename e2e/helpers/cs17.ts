import { APIRequestContext } from "@playwright/test";
import { callGetMethod, createDoc, deleteDoc, getList } from "./frappe";

export interface CS17Profile {
	name: string;
	profile_type: "Student" | "Faculty";
	first_name: string;
	last_name: string;
	full_name?: string;
	cohort?: string | null;
	user?: string | null;
	profile_picture?: string | null;
	creation?: string;
	modified?: string;
}

export interface UserProfileSummary {
	name: string;
	full_name: string;
	profile_type: "Student" | "Faculty";
	cohort: string | null;
	profile_picture: string | null;
}

// Markers used on test-created records so cleanup can find them.
const TEST_FIRST_NAME = "E2E";
const TEST_USER_DOMAIN = "@e2e.cs17.test";

export function generateProfileLastName(prefix = "Test"): string {
	const random = Math.random().toString(36).substring(2, 8);
	return `${prefix}-${Date.now()}-${random}`;
}

export async function createTestProfile(
	request: APIRequestContext,
	options: {
		profileType?: "Student" | "Faculty";
		firstName?: string;
		lastName?: string;
		cohort?: string;
		user?: string;
	} = {},
): Promise<CS17Profile> {
	return createDoc<CS17Profile>(request, "CS17 Profile", {
		profile_type: options.profileType ?? "Student",
		first_name: options.firstName ?? TEST_FIRST_NAME,
		last_name: options.lastName ?? generateProfileLastName(),
		cohort: options.cohort,
		user: options.user,
	});
}

export async function deleteTestProfile(
	request: APIRequestContext,
	name: string,
): Promise<void> {
	await deleteDoc(request, "CS17 Profile", name);
}

export async function cleanupTestProfiles(
	request: APIRequestContext,
): Promise<void> {
	const profiles = await getList<CS17Profile>(request, "CS17 Profile", {
		fields: ["name"],
		filters: { first_name: TEST_FIRST_NAME },
		limit: 200,
	});

	for (const profile of profiles) {
		try {
			await deleteTestProfile(request, profile.name);
		} catch (error) {
			console.warn(`Failed to delete profile ${profile.name}:`, error);
		}
	}
}

export async function createTestUser(
	request: APIRequestContext,
): Promise<{ name: string; email: string }> {
	const email = `e2e-${Date.now()}-${Math.random()
		.toString(36)
		.substring(2, 8)}${TEST_USER_DOMAIN}`;

	const user = await createDoc<{ name: string }>(request, "User", {
		email,
		first_name: TEST_FIRST_NAME,
		send_welcome_email: 0,
		enabled: 1,
	});

	return { name: user.name, email };
}

// Profiles linked to these users must be removed first to avoid LinkExistsError.
export async function cleanupTestUsers(
	request: APIRequestContext,
): Promise<void> {
	const users = await getList<{ name: string }>(request, "User", {
		fields: ["name"],
		filters: { email: ["like", `%${TEST_USER_DOMAIN}`] },
		limit: 200,
	});

	for (const user of users) {
		try {
			await deleteDoc(request, "User", user.name);
		} catch (error) {
			console.warn(`Failed to delete user ${user.name}:`, error);
		}
	}
}

export async function getProfileForUser(
	request: APIRequestContext,
	user: string,
): Promise<CS17Profile | null> {
	const profiles = await getList<CS17Profile>(request, "CS17 Profile", {
		fields: ["name", "profile_type", "full_name"],
		filters: { user },
		limit: 1,
	});
	return profiles[0] ?? null;
}

export async function getUserProfile(
	request: APIRequestContext,
): Promise<UserProfileSummary | null> {
	return callGetMethod<UserProfileSummary | null>(
		request,
		"cs17_portal.api.get_user_profile",
	);
}

export interface CS17Cohort {
	name: string;
	cohort_code: string;
	start_date: string;
}

export interface CS17Assignment {
	name: string;
	title: string;
	cohort: string;
	submission_type: string;
	assignment_type?: string;
	due_date?: string;
	is_published?: number;
}

export interface TestStudent {
	email: string;
	password: string;
	profileName: string;
	cohort: string;
}

const TEST_COHORT_PREFIX = "E2E-";
const TEST_ASSIGNMENT_PREFIX = "E2E Assignment";

export function generateCohortCode(): string {
	const suffix = Date.now().toString().slice(-7);
	return `${TEST_COHORT_PREFIX}${suffix}`;
}

export async function createTestCohort(
	request: APIRequestContext,
	options: { cohortCode?: string; startDate?: string } = {},
): Promise<CS17Cohort> {
	return createDoc<CS17Cohort>(request, "CS17 Cohort", {
		cohort_code: options.cohortCode ?? generateCohortCode(),
		start_date: options.startDate ?? "2026-01-01",
	});
}

export async function cleanupTestCohorts(
	request: APIRequestContext,
): Promise<void> {
	const cohorts = await getList<CS17Cohort>(request, "CS17 Cohort", {
		fields: ["name"],
		filters: { cohort_code: ["like", `${TEST_COHORT_PREFIX}%`] },
		limit: 200,
	});
	for (const cohort of cohorts) {
		try {
			await deleteDoc(request, "CS17 Cohort", cohort.name);
		} catch (error) {
			console.warn(`Failed to delete cohort ${cohort.name}:`, error);
		}
	}
}

// Assignment.before_insert requires the API session (Administrator) to be Faculty.
export async function createTestAssignment(
	request: APIRequestContext,
	options: {
		cohort: string;
		submissionType?: string;
		title?: string;
		assignmentType?: string;
		dueDate?: string;
		isPublished?: boolean;
	},
): Promise<CS17Assignment> {
	const submissionType = options.submissionType ?? "Any";
	return createDoc<CS17Assignment>(request, "CS17 Assignment", {
		title:
			options.title ??
			`${TEST_ASSIGNMENT_PREFIX} ${submissionType} ${Date.now()}`,
		cohort: options.cohort,
		submission_type: submissionType,
		assignment_type: options.assignmentType ?? "Not Graded",
		due_date: options.dueDate ?? "2030-01-01 00:00:00",
		is_published: options.isPublished === false ? 0 : 1,
	});
}

export async function cleanupTestAssignments(
	request: APIRequestContext,
): Promise<void> {
	const assignments = await getList<CS17Assignment>(request, "CS17 Assignment", {
		fields: ["name"],
		filters: { title: ["like", `${TEST_ASSIGNMENT_PREFIX}%`] },
		limit: 200,
	});
	for (const assignment of assignments) {
		try {
			await deleteDoc(request, "CS17 Assignment", assignment.name);
		} catch (error) {
			console.warn(`Failed to delete assignment ${assignment.name}:`, error);
		}
	}
}

export async function cleanupTestSubmissions(
	request: APIRequestContext,
): Promise<void> {
	const submissions = await getList<{ name: string }>(
		request,
		"CS17 Assignment Submission",
		{
			fields: ["name"],
			filters: { full_name: ["like", `${TEST_FIRST_NAME} %`] },
			limit: 500,
		},
	);
	for (const submission of submissions) {
		try {
			await deleteDoc(request, "CS17 Assignment Submission", submission.name);
		} catch (error) {
			console.warn(`Failed to delete submission ${submission.name}:`, error);
		}
	}
}

// Gives the API session user a Faculty profile so it can seed assignments.
// Returns the created profile name, or null if one already existed.
export async function ensureSessionFaculty(
	request: APIRequestContext,
	user = "Administrator",
): Promise<string | null> {
	const existing = await getProfileForUser(request, user);
	if (existing) return null;
	const created = await createTestProfile(request, {
		profileType: "Faculty",
		user,
	});
	return created.name;
}

export async function createTestStudent(
	request: APIRequestContext,
	cohort: string,
): Promise<TestStudent> {
	const suffix = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
	const email = `e2e-student-${suffix}${TEST_USER_DOMAIN}`;
	const password = "e2e-Test-Pass-123";

	await createDoc(request, "User", {
		email,
		first_name: TEST_FIRST_NAME,
		new_password: password,
		send_welcome_email: 0,
		enabled: 1,
		roles: [{ role: "CS17 Student" }],
	});

	const profile = await createTestProfile(request, {
		profileType: "Student",
		user: email,
		cohort,
	});

	return { email, password, profileName: profile.name, cohort };
}
