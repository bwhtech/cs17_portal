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
