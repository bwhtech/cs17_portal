import * as fs from "fs";
import * as path from "path";
import { expect, test as setup } from "@playwright/test";
import { createTestFaculty } from "../helpers/cs17";

const facultyAuthFile = "e2e/.auth/faculty.json";
const facultyInfoFile = "e2e/.auth/faculty-info.json";

setup("seed and authenticate a faculty member", async ({ page, request }) => {
	const authDir = path.dirname(facultyAuthFile);
	if (!fs.existsSync(authDir)) {
		fs.mkdirSync(authDir, { recursive: true });
	}

	const faculty = await createTestFaculty(request);
	fs.writeFileSync(facultyInfoFile, JSON.stringify(faculty));

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
		{ usr: faculty.email, pwd: faculty.password },
	);
	expect(loginResult.ok).toBeTruthy();

	const loggedUser = await page.evaluate(async () => {
		const resp = await fetch("/api/method/frappe.auth.get_logged_user");
		const data = await resp.json();
		return data.message as string;
	});
	expect(loggedUser).toBe(faculty.email);

	await page.context().storageState({ path: facultyAuthFile });
});
