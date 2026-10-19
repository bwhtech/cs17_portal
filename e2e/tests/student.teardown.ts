import * as fs from "fs";
import { test as teardown } from "@playwright/test";
import { deleteTestProfile, deleteTestUser } from "../helpers/cs17";
import { deleteDoc } from "../helpers/frappe";

teardown("delete the seeded student", async ({ request }) => {
	const student = JSON.parse(fs.readFileSync("e2e/.auth/student-info.json", "utf-8"));
	try {
		await deleteTestProfile(request, student.profileName);
		await deleteTestUser(request, student.email);
		await deleteDoc(request, "CS17 Cohort", student.cohortName);
	} catch (error) {
		console.warn(`Failed to delete student ${student.email}:`, error);
	}
});
