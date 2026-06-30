import { test, expect } from "@playwright/test";
import {
	createTestProfile,
	createTestUser,
	deleteTestProfile,
	getProfileForUser,
	getUserProfile,
} from "../helpers/cs17";


test.describe("CS17 Profile", () => {
	test("derives full_name and uses the student naming series", async ({
		request,
	}) => {
		const profile = await createTestProfile(request, {
			profileType: "Student",
			firstName: "E2E",
			lastName: "Student-One",
		});

		expect(profile.full_name).toBe("E2E Student-One");
		expect(profile.name).toMatch(/^CS17-STU-/);
	});

	test("uses the faculty naming series for faculty profiles", async ({
		request,
	}) => {
		const profile = await createTestProfile(request, {
			profileType: "Faculty",
		});

		expect(profile.name).toMatch(/^CS17-FAC-/);
	});

	test("rejects a second profile for the same user", async ({ request }) => {
		const user = await createTestUser(request);
		await createTestProfile(request, { profileType: "Student", user: user.name });

		await expect(
			createTestProfile(request, { profileType: "Faculty", user: user.name }),
		).rejects.toThrow();
	});

	test("get_user_profile returns the session user's profile", async ({
		request,
	}) => {
		// The API keys off frappe.session.user, so ensure that user has a profile.
		const sessionUser = "Administrator";
		const existing = await getProfileForUser(request, sessionUser);
		let createdName: string | null = null;
		if (!existing) {
			const created = await createTestProfile(request, {
				profileType: "Faculty",
				user: sessionUser,
			});
			createdName = created.name;
		}

		const profile = await getUserProfile(request);
		expect(profile).not.toBeNull();
		expect(profile?.profile_type).toBeTruthy();

		if (createdName) {
			await deleteTestProfile(request, createdName);
		}
	});
});
