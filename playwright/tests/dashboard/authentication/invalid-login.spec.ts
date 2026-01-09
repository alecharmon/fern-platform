// spec: Authentication - Login with Invalid Credentials
// seed: N/A (test creates own browser context)

import { expect, test } from "@playwright/test";
import { env } from "../../../utils/env";

test.describe("Authentication", () => {
    test("Login with Invalid Credentials", async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
            // 1. Navigate to http://localhost:3001/login?FERN_CI_AUTOMATED_TESTING=MTdhMTczMTE4MTA
            const loginUrl = `${env.dashboardUrl}/login?FERN_CI_AUTOMATED_TESTING=${encodeURIComponent(env.ciTestingSecret)}`;
            await page.goto(loginUrl);

            // 2. Enter 'invalid@example.com' in the email input field
            await page.fill('[data-testid="ci-email-input"]', "invalid@example.com");

            // 3. Enter 'wrongpassword' in the password input field
            await page.fill('[data-testid="ci-password-input"]', "wrongpassword");

            // 4. Click the 'Sign in with test credentials' button
            await page.click('[data-testid="ci-submit-button"]');

            // 5. Wait for error message to appear (exclude Next.js route announcer)
            const errorMessage = page.locator('[role="alert"]:not(#__next-route-announcer__)');

            // Wait for either an error alert or stay on login page (some implementations show inline errors)
            await page.waitForTimeout(2000); // Give time for any error handling

            // Expected Results:
            // - User remains on the login page (invalid credentials rejected)
            await expect(page).toHaveURL(/.*\/login.*/);

            // - Form inputs remain accessible for retry
            await expect(page.locator('[data-testid="ci-email-input"]')).toBeVisible();
            await expect(page.locator('[data-testid="ci-password-input"]')).toBeVisible();
            await expect(page.locator('[data-testid="ci-submit-button"]')).toBeVisible();

            // - Check for error indication (either alert role or error text in body)
            const hasErrorAlert = (await errorMessage.count()) > 0;
            const bodyText = await page.locator("body").textContent();
            const hasErrorText =
                bodyText?.toLowerCase().includes("invalid") ||
                bodyText?.toLowerCase().includes("error") ||
                bodyText?.toLowerCase().includes("failed") ||
                bodyText?.toLowerCase().includes("incorrect");

            // At minimum, user should still be on login page (not redirected to dashboard)
            expect(hasErrorAlert || hasErrorText).toBeTruthy(); // Login rejection is the key assertion
        } finally {
            await context.close();
        }
    });
});
