import { expect, Locator, Page } from "@playwright/test";

export class LoginPage {
	private page: Page;
	private emailInput: Locator;
	private passwordInput: Locator;
	private submitButton: Locator;
	private errorMessage: Locator;

	constructor(page: Page) {
		this.page = page;
		this.emailInput = page.locator("#login_email");
		this.passwordInput = page.locator("#login_password");
		this.submitButton = page.locator("button.btn-login");
		this.errorMessage = page.locator(".msgprint, .alert-danger").first();
	}

	async goto(): Promise<void> {
		await this.page.goto("/login");
		await this.emailInput.waitFor({ state: "visible" });
		await this.passwordInput.waitFor({ state: "visible" });
	}

	async fillCredentials(email: string, password: string): Promise<void> {
		await this.emailInput.fill(email);
		await this.passwordInput.fill(password);
	}

	async submit(): Promise<void> {
		await this.submitButton.click();
	}

	async login(email = "Administrator", password = "admin"): Promise<void> {
		await this.goto();
		await this.fillCredentials(email, password);
		await this.submit();
		await this.page.waitForURL(/\/(app|desk|dashboard)/, { timeout: 30000 });
	}

	async expectLoginError(): Promise<void> {
		await expect(this.errorMessage).toBeVisible();
	}

	async expectToBeOnLoginPage(): Promise<void> {
		await expect(this.page).toHaveURL(/.*login.*/);
	}
}
