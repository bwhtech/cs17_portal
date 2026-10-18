import * as fs from "fs";
import { expect, Page } from "@playwright/test";
import { TEST_ASSIGNMENT_PREFIX } from "./cs17";

export const SAMPLE_PROJECT = fs
	.readFileSync("cs17_portal/public/scratch/sample.sb3")
	.toString("base64");

export async function saveProjectAsStudent(page: Page, project: string) {
	await page.waitForFunction(
		() =>
			(window as any).csrf_token !== undefined ||
			(window as any).frappe?.csrf_token !== undefined,
		{ timeout: 15000 }
	);
	return page.evaluate(
		async ({ project, content }) => {
			const token = (window as any).csrf_token ?? (window as any).frappe?.csrf_token;
			const resp = await fetch("/api/method/cs17_portal.api.save_project", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Frappe-CSRF-Token": token,
				},
				body: JSON.stringify({
					project,
					filename: "project.sb3",
					content,
				}),
			});
			return { ok: resp.ok, status: resp.status };
		},
		{ project, content: SAMPLE_PROJECT }
	);
}

export async function callAsStudent(page: Page, method: string, body: unknown) {
	return page.evaluate(
		async ({ method, body }) => {
			const token = (window as any).csrf_token ?? (window as any).frappe?.csrf_token;
			const resp = await fetch(`/api/method/${method}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Frappe-CSRF-Token": token,
				},
				body: JSON.stringify(body),
			});
			return { ok: resp.ok, body: await resp.json() };
		},
		{ method, body }
	);
}

export async function openProjectWithUnsavedEdit(page: Page, assignment?: string) {
	await page.goto("/dashboard/projects");
	const created = await callAsStudent(page, "cs17_portal.api.create_project", {
		project_title: `${TEST_ASSIGNMENT_PREFIX} Unsaved ${Date.now()}`,
		assignment,
	});
	await saveProjectAsStudent(page, created.body.message.name);

	await page.goto(`/dashboard/projects/${created.body.message.name}/edit`);
	const editor = page.getByTitle("Scratch editor");
	await expect(editor).toBeVisible();
	await expect
		.poll(() =>
			editor
				.contentFrame()
				.locator("html")
				.evaluate(() =>
					(window as any).cs17vm?.runtime.targets.map((target: any) => target.getName())
				)
		)
		.toEqual(["Stage"]);
	await editor
		.contentFrame()
		.locator("html")
		.evaluate(() => (window as any).cs17vm.runtime.emitProjectChanged());
}
