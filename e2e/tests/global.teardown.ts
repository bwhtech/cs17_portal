import { test as teardown } from "@playwright/test";
import {
	cleanupTestAssignments,
	cleanupTestCohorts,
	cleanupTestProfiles,
	cleanupTestSubmissions,
	cleanupTestUsers,
} from "../helpers/cs17";

teardown("clean up E2E data", async ({ request }) => {
	await cleanupTestSubmissions(request);
	await cleanupTestAssignments(request);
	await cleanupTestProfiles(request);
	await cleanupTestUsers(request);
	await cleanupTestCohorts(request);
});
