import { test, expect } from "@playwright/test";
import { CS17Profile, ensureSessionFaculty, getProfileForUser } from "../helpers/cs17";
import { callMethod, deleteDoc, getDoc, updateDoc } from "../helpers/frappe";

const UPDATE = "cs17_portal.api.update_my_profile";

interface UpdatedProfile {
	name: string;
	full_name: string;
	profile_picture: string | null;
}

test.describe("Faculty profile editing", () => {
	let profileName: string;
	let createdProfile: string | null = null;
	let original: CS17Profile;

	test.beforeAll(async ({ request }) => {
		createdProfile = await ensureSessionFaculty(request);
		const profile = await getProfileForUser(request, "Administrator");
		profileName = profile!.name;
		original = await getDoc<CS17Profile>(request, "CS17 Profile", profileName);
	});

	test.afterAll(async ({ request }) => {
		if (createdProfile) {
			await deleteTestProfileSafely(request, createdProfile);
			return;
		}
		await updateDoc(request, "CS17 Profile", profileName, {
			first_name: original.first_name,
			last_name: original.last_name,
			profile_picture: original.profile_picture ?? null,
		});
	});

	async function deleteTestProfileSafely(request: any, name: string) {
		try {
			await deleteDoc(request, "CS17 Profile", name);
		} catch (error) {
			console.warn(`Failed to delete profile ${name}:`, error);
		}
	}

	test("saves the name and derives full_name", async ({ request }) => {
		const updated = await callMethod<UpdatedProfile>(request, UPDATE, {
			first_name: "Renamed",
			last_name: "Faculty",
		});

		expect(updated.full_name).toBe("Renamed Faculty");
		const doc = await getDoc<CS17Profile>(request, "CS17 Profile", profileName);
		expect(doc.first_name).toBe("Renamed");
		expect(doc.last_name).toBe("Faculty");
	});

	test("sets and clears the profile picture", async ({ request }) => {
		await callMethod<UpdatedProfile>(request, UPDATE, {
			first_name: "Photo",
			last_name: "Faculty",
			profile_picture: "/files/e2e-avatar.png",
		});
		let doc = await getDoc<CS17Profile>(request, "CS17 Profile", profileName);
		expect(doc.profile_picture).toBe("/files/e2e-avatar.png");

		await callMethod<UpdatedProfile>(request, UPDATE, {
			first_name: "Photo",
			last_name: "Faculty",
			profile_picture: "",
		});
		doc = await getDoc<CS17Profile>(request, "CS17 Profile", profileName);
		expect(doc.profile_picture).toBeFalsy();
	});

	test("rejects a blank last name", async ({ request }) => {
		await expect(
			callMethod<UpdatedProfile>(request, UPDATE, {
				first_name: "OnlyFirst",
				last_name: "",
			}),
		).rejects.toThrow();
	});
});
