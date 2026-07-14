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
const UPDATE = "cs17_portal.api.update_announcement";
const PUBLISH = "cs17_portal.api.publish_announcement";
const DELETE = "cs17_portal.api.delete_announcement";
const LIST = "cs17_portal.api.get_faculty_announcements";
const STUDENT_LIST = "cs17_portal.api.get_student_announcements";

interface StudentAnnouncements {
	announcements: Array<{ name: string }>;
	next_publish_on: string | null;
}

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

	test("saves a draft with only a title (content optional)", async ({ request }) => {
		const name = await callMethod<string>(request, CREATE, {
			title: announcementTitle(),
			content: "",
			publish: "draft",
		});
		const doc = await getDoc<CS17Announcement>(request, "CS17 Announcement", name);
		expect(doc.is_published).toBe(0);
	});

	test("publishes a title-only announcement (content optional)", async ({ request }) => {
		const name = await callMethod<string>(request, CREATE, {
			title: announcementTitle(),
			content: "",
			publish: "now",
		});
		const doc = await getDoc<CS17Announcement>(request, "CS17 Announcement", name);
		expect(doc.is_published).toBe(1);
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

	test("schedules an announcement for later and rejects a missing date", async ({ request }) => {
		const name = await createAnnouncement(request, {
			publish: "schedule",
			publish_on: "2035-06-01 09:00:00",
		});
		const doc = await getDoc<CS17Announcement>(request, "CS17 Announcement", name);
		expect(doc.is_published).toBe(0);
		expect(doc.publish_on).toContain("2035-06-01");

		await expect(
			createAnnouncement(request, { publish: "schedule" }),
		).rejects.toThrow();
	});

	test("edits an unpublished announcement", async ({ request }) => {
		const name = await createAnnouncement(request, { publish: "draft" });
		const newTitle = `${TEST_ANNOUNCEMENT_PREFIX} Edited ${Date.now()}`;
		await callMethod(request, UPDATE, {
			announcement: name,
			title: newTitle,
			content: "updated body",
			publish: "draft",
		});
		const doc = await getDoc<CS17Announcement>(request, "CS17 Announcement", name);
		expect(doc.title).toBe(newTitle);
		expect(doc.content).toBe("updated body");
	});

	test("refuses to edit a published announcement", async ({ request }) => {
		const name = await createAnnouncement(request, { publish: "now" });
		await expect(
			callMethod(request, UPDATE, {
				announcement: name,
				title: "nope",
				content: "nope",
				publish: "draft",
			}),
		).rejects.toThrow();
	});

	test("student sees a cohort-less (all cohorts) announcement", async ({ request }) => {
		const allCohorts = await createAnnouncement(request, { publish: "now" });
		const result = await callGetMethod<StudentAnnouncements>(request, STUDENT_LIST, {
			cohort: cohort.name,
		});
		const names = result.announcements.map((a) => a.name);
		expect(names).toContain(allCohorts);
	});

	test("student sees published + past-scheduled, not future-scheduled", async ({ request }) => {
		const published = await createAnnouncement(request, {
			publish: "now",
			cohort: cohort.name,
		});
		const pastScheduled = await createAnnouncement(request, {
			publish: "schedule",
			publish_on: "2000-01-01 00:00:00",
			cohort: cohort.name,
		});
		const futureScheduled = await createAnnouncement(request, {
			publish: "schedule",
			publish_on: "2035-01-01 00:00:00",
			cohort: cohort.name,
		});

		const result = await callGetMethod<StudentAnnouncements>(request, STUDENT_LIST, {
			cohort: cohort.name,
		});
		const names = result.announcements.map((a) => a.name);
		expect(names).toContain(published);
		expect(names).toContain(pastScheduled);
		expect(names).not.toContain(futureScheduled);
		expect(result.next_publish_on).toBeTruthy();
	});

	test("deletes an announcement", async ({ request }) => {
		const name = await createAnnouncement(request, { publish: "draft" });
		await callMethod(request, DELETE, { announcement: name });
		expect(await docExists(request, "CS17 Announcement", name)).toBe(false);
	});
});
