import * as fs from "fs";
import { test as teardown } from "@playwright/test";
import { deleteTestProfile, deleteTestUser } from "../helpers/cs17";
import { deleteDoc } from "../helpers/frappe";

teardown("delete the seeded guardian", async ({ request }) => {
	const guardian = JSON.parse(fs.readFileSync("e2e/.auth/guardian-info.json", "utf-8"));
	try {
		await deleteTestProfile(request, guardian.profileName);
		await deleteTestUser(request, guardian.email);
		await deleteTestProfile(request, guardian.student);
		await deleteDoc(request, "CS17 Cohort", guardian.cohortName);
	} catch (error) {
		console.warn(`Failed to delete guardian ${guardian.email}:`, error);
	}
});
