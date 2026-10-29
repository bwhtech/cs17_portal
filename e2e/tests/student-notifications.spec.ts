import * as fs from "fs";
import { test, expect } from "@playwright/test";
import { CS17Assignment, createTestAssignment } from "../helpers/cs17";
import { createDoc, deleteDoc, getDoc, getList } from "../helpers/frappe";

test.describe("Student notifications", () => {
	let assignment: CS17Assignment;
	let notification: { name: string };

	test.beforeAll(async ({ request }) => {
		const { cohort, email } = JSON.parse(
			fs.readFileSync("e2e/.auth/student-info.json", "utf-8")
		);
		assignment = await createTestAssignment(request, { cohort });
		notification = await createDoc(request, "Notification Log", {
			type: "Alert",
			for_user: email,
			subject: `Due in 24 hours: ${assignment.title}`,
			document_type: "CS17 Assignment",
			document_name: assignment.name,
		});
	});

	test.afterAll(async ({ request }) => {
		const logs = await getList<{ name: string }>(request, "Notification Log", {
			filters: { document_name: assignment.name },
		});
		for (const log of logs) await deleteDoc(request, "Notification Log", log.name);
		await deleteDoc(request, "CS17 Assignment", assignment.name);
	});

	test("opens the assignment from the bell and marks it read", async ({ page, request }) => {
		await page.goto("/dashboard");
		await page.getByRole("button", { name: /^Notifications, \d+ unread$/ }).click();
		await page.getByText(`Due in 24 hours: ${assignment.title}`).click();

		await expect(page).toHaveURL(
			new RegExp(`/dashboard/assignments/${assignment.name}/submission$`)
		);
		await expect
			.poll(
				async () =>
					(
						await getDoc<{ read: number }>(
							request,
							"Notification Log",
							notification.name
						)
					).read
			)
			.toBe(1);
	});
});
