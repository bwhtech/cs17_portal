import { defineConfig, devices } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, "e2e", ".auth", "user.json");
const studentAuthFile = path.join(__dirname, "e2e", ".auth", "student.json");
const facultyAuthFile = path.join(__dirname, "e2e", ".auth", "faculty.json");
const guardianAuthFile = path.join(__dirname, "e2e", ".auth", "guardian.json");
const guardianSpecs = /guardian-dashboard\.spec\.ts/;
const studentSpecs =
	/(student-submission|student-theme|student-results|student-assignment-title|student-service-worker|student-notifications|python-assignments|python-time-limit|editor-failed-save|python-self-hosted|python-local-copy|python-paste-log|student-explain-request|student-late-work|student-topic-progress|student-project-gallery|student-celebration|student-python-hints|student-peer-review|scratch-local-copy|student-coding-exam)\.spec\.ts/;
const facultySpecs =
	/(faculty-announcements-ui|faculty-assignments-ui|faculty-profile-ui|faculty-projects|faculty-assignment-students|faculty-assignment-topics|faculty-assignment-difficulty|faculty-dashboard|faculty-ai-check|faculty-send-back|faculty-not-graded-remarks|faculty-remarks-text|faculty-grading-navigation|faculty-copy-assignments|faculty-similar-code|faculty-student-page|faculty-class-report|faculty-results|faculty-student-import|faculty-cohort-archive|faculty-submissions-paging|faculty-code-comments|faculty-saved-remarks|faculty-voice-remarks|faculty-code-replay|faculty-explain-request|faculty-live-lab|faculty-late-work|faculty-gradebook|faculty-topic-progress|faculty-rubric|faculty-submission-tests|faculty-peer-review|faculty-coding-exam)\.spec\.ts/;

const SITE_HOST = process.env.SITE_HOST || "cs17.portal:8000";
const SITE_DOMAIN = SITE_HOST.split(":")[0];
const PAGE_BASE = process.env.BASE_URL || `http://${SITE_HOST}`;

export default defineConfig({
	testDir: "./e2e/tests",
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "html",
	timeout: 60000,

	expect: {
		timeout: 10000,
	},

	use: {
		baseURL: PAGE_BASE,
		trace: "on-first-retry",
		video: "retain-on-failure",
		screenshot: "only-on-failure",
		actionTimeout: 15000,
		navigationTimeout: 30000,
		serviceWorkers: "block",
	},

	projects: [
		{
			name: "setup",
			testMatch: /auth\.setup\.ts/,
			use: {
				...devices["Desktop Chrome"],
				launchOptions: {
					args: [`--host-resolver-rules=MAP ${SITE_DOMAIN} 127.0.0.1`],
				},
			},
		},
		{
			name: "student-setup",
			testMatch: /student\.setup\.ts/,
			use: {
				...devices["Desktop Chrome"],
				launchOptions: {
					args: [`--host-resolver-rules=MAP ${SITE_DOMAIN} 127.0.0.1`],
				},
			},
			dependencies: ["setup"],
			teardown: "student-teardown",
		},
		{
			name: "student-teardown",
			testMatch: /student\.teardown\.ts/,
		},
		{
			name: "chromium",
			testIgnore: [studentSpecs, facultySpecs, guardianSpecs],
			use: {
				...devices["Desktop Chrome"],
				storageState: authFile,
				launchOptions: {
					args: [`--host-resolver-rules=MAP ${SITE_DOMAIN} 127.0.0.1`],
				},
			},
			dependencies: ["setup"],
		},
		{
			name: "chromium-student",
			testMatch: studentSpecs,
			use: {
				...devices["Desktop Chrome"],
				storageState: studentAuthFile,
				launchOptions: {
					args: [`--host-resolver-rules=MAP ${SITE_DOMAIN} 127.0.0.1`],
				},
			},
			dependencies: ["student-setup"],
		},
		{
			name: "faculty-setup",
			testMatch: /faculty\.setup\.ts/,
			use: {
				...devices["Desktop Chrome"],
				launchOptions: {
					args: [`--host-resolver-rules=MAP ${SITE_DOMAIN} 127.0.0.1`],
				},
			},
			dependencies: ["setup"],
			teardown: "faculty-teardown",
		},
		{
			name: "faculty-teardown",
			testMatch: /faculty\.teardown\.ts/,
		},
		{
			name: "chromium-faculty",
			testMatch: facultySpecs,
			use: {
				...devices["Desktop Chrome"],
				storageState: facultyAuthFile,
				launchOptions: {
					args: [`--host-resolver-rules=MAP ${SITE_DOMAIN} 127.0.0.1`],
				},
			},
			dependencies: ["faculty-setup"],
		},
		{
			name: "guardian-setup",
			testMatch: /guardian\.setup\.ts/,
			use: {
				...devices["Desktop Chrome"],
				launchOptions: {
					args: [`--host-resolver-rules=MAP ${SITE_DOMAIN} 127.0.0.1`],
				},
			},
			dependencies: ["setup"],
			teardown: "guardian-teardown",
		},
		{
			name: "guardian-teardown",
			testMatch: /guardian\.teardown\.ts/,
		},
		{
			name: "chromium-guardian",
			testMatch: guardianSpecs,
			use: {
				...devices["Desktop Chrome"],
				storageState: guardianAuthFile,
				launchOptions: {
					args: [`--host-resolver-rules=MAP ${SITE_DOMAIN} 127.0.0.1`],
				},
			},
			dependencies: ["guardian-setup"],
		},
		{
			name: "firefox",
			testIgnore: [studentSpecs, facultySpecs, guardianSpecs],
			use: {
				...devices["Desktop Firefox"],
				storageState: authFile,
			},
			dependencies: ["setup"],
		},
		{
			name: "webkit",
			testIgnore: [studentSpecs, facultySpecs, guardianSpecs],
			use: {
				...devices["Desktop Safari"],
				storageState: authFile,
			},
			dependencies: ["setup"],
		},
	],
});
