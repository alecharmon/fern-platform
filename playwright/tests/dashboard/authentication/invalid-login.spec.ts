import { expect, test } from "@playwright/test";
import { env } from "../../../utils/env";

test.describe("Authentication", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("Login with Invalid Credentials", async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
            // Navigate to login page and enter an invalid email
            await page.goto(`${env.dashboardUrl}/login`, { waitUntil: "networkidle" });
            const emailField = page.getByPlaceholder("Enter email address");
            await emailField.waitFor({ state: "visible", timeout: 15000 });
            await emailField.fill("invalid@example.com");
            await page.locator('form button[type="submit"]').click();

            // Should show an error or stay on the login page
            // (email not found in Auth0 → the /api/login/email returns 404)
            await page.waitForTimeout(3000);

            // User should remain on the login page
            await expect(page).toHaveURL(/.*\/login.*/);
        } finally {
            await context.close();
        }
    });
});
