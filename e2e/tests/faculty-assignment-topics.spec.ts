import { test, expect, type Page } from "@playwright/test";
import {
	CS17Cohort,
	TEST_ASSIGNMENT_PREFIX,
	cleanupTestAssignments,
	createTestAssignment,
	createTestCohort,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { createDoc, deleteDoc, getList } from "../helpers/frappe";

const LIST_ROW = '[data-slot="list-row"]';
const TEST_TOPIC_PREFIX = "E2E Topic";

function topicSection(page: Page, topic: string) {
	return page.locator("section", { has: page.getByRole("heading", { name: topic }) });
}

let cohort: CS17Cohort;

test.describe("Assignment topics", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestAssignments(request, cohort.name);
		const topics = await getList<{ name: string }>(request, "CS17 Topic", {
			fields: ["name"],
			filters: { name: ["like", `${TEST_TOPIC_PREFIX}%`] },
		});
		for (const topic of topics) await deleteDoc(request, "CS17 Topic", topic.name);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("moves an assignment to a new topic from the bulk bar", async ({ page, request }) => {
		const assignment = await createTestAssignment(request, { cohort: cohort.name });
		const topic = `${TEST_TOPIC_PREFIX} Loops ${Date.now()}`;

		await page.goto("/dashboard/faculty/assignments");
		await page.locator(LIST_ROW, { hasText: assignment.title }).getByRole("checkbox").click();
		await page.getByRole("button", { name: "Move to topic" }).click();
		await page.getByPlaceholder("Find or create a topic").fill(topic);
		await page.getByRole("option", { name: `Create “${topic}”` }).click();

		await expect(
			topicSection(page, topic).locator(LIST_ROW, { hasText: assignment.title })
		).toBeVisible();
	});

	test("drags an assignment onto another topic", async ({ page, request }) => {
		const stamp = Date.now();
		const from = await createDoc<{ name: string }>(request, "CS17 Topic", {
			topic_name: `${TEST_TOPIC_PREFIX} Loops ${stamp}`,
		});
		const to = await createDoc<{ name: string }>(request, "CS17 Topic", {
			topic_name: `${TEST_TOPIC_PREFIX} Conditionals ${stamp}`,
		});
		const assignment = await createTestAssignment(request, {
			cohort: cohort.name,
			topic: from.name,
		});
		await createTestAssignment(request, { cohort: cohort.name, topic: to.name });

		await page.goto("/dashboard/faculty/assignments");
		await page
			.locator(LIST_ROW, { hasText: assignment.title })
			.dragTo(topicSection(page, to.name));

		await expect(
			topicSection(page, to.name).locator(LIST_ROW, { hasText: assignment.title })
		).toBeVisible();
	});

	test("creates an assignment under a topic made in the New topic dialog", async ({ page }) => {
		const title = `${TEST_ASSIGNMENT_PREFIX} Topic ${Date.now()}`;
		const topic = `${TEST_TOPIC_PREFIX} Conditionals ${Date.now()}`;

		await page.goto("/dashboard/faculty/assignments");
		await page.getByRole("button", { name: "New Assignment" }).click();
		await page.getByPlaceholder("Assignment title").fill(title);
		await page
			.getByRole("combobox")
			.filter({ hasText: /Select a cohort|No cohort/ })
			.click();
		await page.getByRole("listbox").waitFor();
		await page.keyboard.type(cohort.name);
		await page.keyboard.press("Enter");
		await page.getByRole("combobox", { name: "Topic" }).click();
		await page.getByRole("option", { name: "New topic" }).click();
		await page.getByRole("textbox", { name: "Name" }).fill(topic);
		await page.getByRole("button", { name: "Create", exact: true }).click();
		await expect(page.getByRole("combobox", { name: "Topic" })).toHaveValue(topic);
		await page.getByRole("button", { name: "Create Assignment" }).click();

		await expect(
			topicSection(page, topic).locator(LIST_ROW, { hasText: title })
		).toBeVisible();
	});
});
