import { APIRequestContext } from "@playwright/test";
import { test, expect } from "@playwright/test";
import {
	CS17Announcement,
	CS17Cohort,
	TEST_ANNOUNCEMENT_PREFIX,
	cleanupTestAnnouncements,
	createTestCohort,
	ensureSessionFaculty,
} from "../helpers/cs17";
import { callGetMethod, callMethod, deleteDoc, docExists, getDoc } from "../helpers/frappe";

const CREATE = "cs17_portal.api.create_announcement";
const PUBLISH = "cs17_portal.api.publish_announcement";
const DELETE = "cs17_portal.api.delete_announcement";
const LIST = "cs17_portal.api.get_faculty_announcements";

let cohort: CS17Cohort;
let counter = 0;

function announcementTitle(): string {
	return `${TEST_ANNOUNCEMENT_PREFIX} ${Date.now()}-${counter++}`;
}

function createAnnouncement(
	request: APIRequestContext,
	overrides: Record<string, unknown> = {},
): Promise<string> {
	return callMethod<string>(request, CREATE, {
		title: announcementTitle(),
		content: "Please read the handbook.",
		...overrides,
	});
}

test.describe("Faculty announcement management", () => {
	test.beforeAll(async ({ request }) => {
		await ensureSessionFaculty(request);
		cohort = await createTestCohort(request);
	});

	test.afterAll(async ({ request }) => {
		await cleanupTestAnnouncements(request);
		await deleteDoc(request, "CS17 Cohort", cohort.name);
	});

	test("saves a draft announcement that stays unpublished", async ({ request }) => {
		const name = await createAnnouncement(request, { publish: "draft" });
		const doc = await getDoc<CS17Announcement>(request, "CS17 Announcement", name);
		expect(doc.is_published).toBe(0);
		expect(doc.published_date).toBeFalsy();
	});

	test("publishes an announcement immediately with today's date", async ({ request }) => {
		const name = await createAnnouncement(request, {
			publish: "now",
			alert_variant: "warning",
			cohort: cohort.name,
		});
		const doc = await getDoc<CS17Announcement>(request, "CS17 Announcement", name);
		expect(doc.is_published).toBe(1);
		expect(doc.published_date).toBeTruthy();
		expect(doc.alert_variant).toBe("warning");
		expect(doc.cohort).toBe(cohort.name);
	});

	test("publishes an existing draft now", async ({ request }) => {
		const name = await createAnnouncement(request, { publish: "draft" });
		await callMethod(request, PUBLISH, { announcement: name });

		const doc = await getDoc<CS17Announcement>(request, "CS17 Announcement", name);
		expect(doc.is_published).toBe(1);
		expect(doc.published_date).toBeTruthy();
	});

	test("lists announcements including drafts across cohorts", async ({ request }) => {
		const draft = await createAnnouncement(request, { publish: "draft" });
		const published = await createAnnouncement(request, {
			publish: "now",
			cohort: cohort.name,
		});

		const announcements = await callGetMethod<CS17Announcement[]>(request, LIST, {});
		const names = announcements.map((a) => a.name);
		expect(names).toContain(draft);
		expect(names).toContain(published);
	});

	test("deletes an announcement", async ({ request }) => {
		const name = await createAnnouncement(request, { publish: "draft" });
		await callMethod(request, DELETE, { announcement: name });
		expect(await docExists(request, "CS17 Announcement", name)).toBe(false);
	});
});
