import * as fs from "fs";
import * as path from "path";
import { expect, test as setup } from "@playwright/test";
import { createTestCohort, createTestStudent } from "../helpers/cs17";

const studentAuthFile = "e2e/.auth/student.json";
const studentInfoFile = "e2e/.auth/student-info.json";

setup("seed and authenticate a student", async ({ page, request }) => {
	const authDir = path.dirname(studentAuthFile);
	if (!fs.existsSync(authDir)) {
		fs.mkdirSync(authDir, { recursive: true });
	}

	const cohort = await createTestCohort(request);
	const student = await createTestStudent(request, cohort.cohort_code);
	fs.writeFileSync(
		studentInfoFile,
		JSON.stringify({ ...student, cohortName: cohort.name }),
	);

	await page.goto("/login");
	await page.waitForLoadState("domcontentloaded");

	const loginResult = await page.evaluate(
		async ({ usr, pwd }) => {
			const resp = await fetch("/api/method/login", {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: `usr=${encodeURIComponent(usr)}&pwd=${encodeURIComponent(pwd)}`,
			});
			return { ok: resp.ok, status: resp.status };
		},
		{ usr: student.email, pwd: student.password },
	);
	expect(loginResult.ok).toBeTruthy();

	const loggedUser = await page.evaluate(async () => {
		const resp = await fetch("/api/method/frappe.auth.get_logged_user");
		const data = await resp.json();
		return data.message as string;
	});
	expect(loggedUser).toBe(student.email);

	await page.context().storageState({ path: studentAuthFile });
});
