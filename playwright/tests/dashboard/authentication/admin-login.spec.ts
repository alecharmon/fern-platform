// spec: Admin Login with CI Credentials
// seed: dashboard/seed.spec.ts

import { expect, test } from "@playwright/test";
import { env } from "../../../utils/env";

test.describe("Authentication", () => {
    test("Admin Login with CI Credentials", async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
            // 1. Navigate to http://localhost:3001/login?FERN_CI_AUTOMATED_TESTING=MTdhMTczMTE4MTA
            const loginUrl = `${env.dashboardUrl}/login?FERN_CI_AUTOMATED_TESTING=${encodeURIComponent(env.ciTestingSecret)}`;
            await page.goto(loginUrl);

            // 2. Verify the CI Automated Testing Login form is visible
            await expect(page.locator('[data-testid="ci-email-input"]')).toBeVisible();
            await expect(page.locator('[data-testid="ci-password-input"]')).toBeVisible();
            await expect(page.locator('[data-testid="ci-submit-button"]')).toBeVisible();

            // 3. Enter 'ci-admin@buildwithfern.com' in the email input field [data-testid='ci-email-input']
            await page.fill('[data-testid="ci-email-input"]', "ci-admin@buildwithfern.com");

            // 4. Enter the CI test password in the password input field [data-testid='ci-password-input']
            await page.fill('[data-testid="ci-password-input"]', env.ciTestingSecret);

            // 5. Click the 'Sign in with test credentials' button [data-testid='ci-submit-button']
            await page.click('[data-testid="ci-submit-button"]');

            // 6. Wait for redirect to dashboard home page
            await page.waitForURL("**/", { timeout: 30000 });

            // Expected Results:
            // - Login page loads successfully with CI testing form visible (verified in step 2)
            // - Form accepts email and password input (verified in steps 3-4)
            // - Upon successful authentication, user is redirected to the dashboard (verified in step 6)
            // - No error messages are displayed (excluding Next.js route announcer)
            await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).not.toBeVisible();

            // - Dashboard displays organization content
            await expect(page.locator("body")).not.toContainText("Sign in");
        } finally {
            await context.close();
        }
    });
});
