import { test } from "@playwright/test";
test.use({ storageState: "e2e/.auth/faculty.json" });

async function fillAll(page: any, title: string) {
	await page.getByRole("button", { name: /New Assignment/i }).click();
	await page.getByPlaceholder("Assignment title").fill(title);
	await page.locator("button:has-text('Select a cohort')").click();
	await page.locator("[role=option]").first().click();
	await page.locator("button:has-text('Any')").first().click();
	await page.getByRole("option", { name: "PDF" }).click();
	await page.locator("button:has-text('Non-graded')").click();
	await page.getByRole("option", { name: "Marks" }).click();
	await page.locator("input[type=number]").fill("88");
	await page.locator("input[type=datetime-local]").first().fill("2030-06-06T11:00");
	await page.locator("textarea").fill("full desc");
}

test("close via overlay click", async ({ page }) => {
	await page.goto("/dashboard/faculty/assignments");
	await page.waitForLoadState("networkidle");
	await fillAll(page, "REPRO_OVERLAY");
	// click on the overlay (outside the sheet) at far-left
	await page.mouse.click(50, 360);
	await page.waitForTimeout(2500);
});

test("close via Escape while cohort dropdown open", async ({ page }) => {
	await page.goto("/dashboard/faculty/assignments");
	await page.waitForLoadState("networkidle");
	await fillAll(page, "REPRO_MIDSELECT");
	// open a select then press Escape twice (closes select, then sheet)
	await page.locator("button:has-text('PDF')").first().click();
	await page.keyboard.press("Escape");
	await page.keyboard.press("Escape");
	await page.waitForTimeout(2500);
});
