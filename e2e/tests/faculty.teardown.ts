import * as fs from "fs";
import { test as teardown } from "@playwright/test";
import { deleteTestProfile, deleteTestUser } from "../helpers/cs17";

teardown("delete the seeded faculty member", async ({ request }) => {
	const faculty = JSON.parse(fs.readFileSync("e2e/.auth/faculty-info.json", "utf-8"));
	try {
		await deleteTestProfile(request, faculty.profileName);
		await deleteTestUser(request, faculty.email);
	} catch (error) {
		console.warn(`Failed to delete faculty ${faculty.email}:`, error);
	}
});
