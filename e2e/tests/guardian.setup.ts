import * as fs from "fs";
import * as path from "path";
import { expect, test as setup } from "@playwright/test";
import { createTestCohort, createTestProfile, generateProfileLastName } from "../helpers/cs17";
import { createDoc } from "../helpers/frappe";

const guardianAuthFile = "e2e/.auth/guardian.json";
const guardianInfoFile = "e2e/.auth/guardian-info.json";

setup("seed and authenticate a guardian", async ({ page, request }) => {
	const authDir = path.dirname(guardianAuthFile);
	if (!fs.existsSync(authDir)) {
		fs.mkdirSync(authDir, { recursive: true });
	}

	const cohort = await createTestCohort(request);
	const student = await createTestProfile(request, { cohort: cohort.name });
	const suffix = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
	const email = `e2e-guardian-${suffix}@e2e.cs17.test`;
	const password = "e2e-Test-Pass-123";

	await createDoc(request, "User", {
		email,
		first_name: "E2E",
		new_password: password,
		send_welcome_email: 0,
		enabled: 1,
	});
	const guardian = await createDoc<{ name: string }>(request, "CS17 Profile", {
		profile_type: "Guardian",
		first_name: "E2E",
		last_name: generateProfileLastName(),
		user: email,
		students: [{ student: student.name }],
	});
	fs.writeFileSync(
		guardianInfoFile,
		JSON.stringify({
			email,
			password,
			profileName: guardian.name,
			student: student.name,
			studentName: student.full_name,
			cohortName: cohort.name,
		})
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
		{ usr: email, pwd: password }
	);
	expect(loginResult.ok).toBeTruthy();

	const loggedUser = await page.evaluate(async () => {
		const resp = await fetch("/api/method/frappe.auth.get_logged_user");
		const data = await resp.json();
		return data.message as string;
	});
	expect(loggedUser).toBe(email);

	await page.context().storageState({ path: guardianAuthFile });
});
