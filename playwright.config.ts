import { defineConfig, devices } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, "e2e", ".auth", "user.json");
const studentAuthFile = path.join(__dirname, "e2e", ".auth", "student.json");
const studentSpecs = /student-submission\.spec\.ts/;

const SITE_HOST = process.env.SITE_HOST || "cs17.portal:8000";
const SITE_DOMAIN = SITE_HOST.split(":")[0];
const API_BASE = process.env.API_BASE || "http://127.0.0.1:8000";
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
		},
		{
			name: "chromium",
			testIgnore: studentSpecs,
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
			name: "firefox",
			testIgnore: studentSpecs,
			use: {
				...devices["Desktop Firefox"],
				storageState: authFile,
			},
			dependencies: ["setup"],
		},
		{
			name: "webkit",
			testIgnore: studentSpecs,
			use: {
				...devices["Desktop Safari"],
				storageState: authFile,
			},
			dependencies: ["setup"],
		},
	],
});
