// spec: Authentication - Redirect to Dashboard When Already Authenticated
// seed: dashboard/seed.spec.ts

import { expect, test } from "../../../fixtures/auth.fixture";
import { env } from "../../../utils/env";

test.describe("Authentication", () => {
    test("Redirect to Dashboard When Already Authenticated", async ({ homePage: adminPage, browserName }) => {
        test.skip(
            browserName === "firefox",
            "Firefox aborts navigation with NS_BINDING_ABORTED during fast auth redirect"
        );

        // 1. Login as admin user using CI credentials (already done via adminPage fixture)
        // 2. Verify dashboard is displayed
        await expect(adminPage).toHaveURL(/.*\//);
        await expect(adminPage.locator("body")).not.toContainText("Sign in");

        // 3. Navigate directly to login page
        await adminPage.goto(`${env.dashboardUrl}/login`);

        // 4. Observe redirect behavior
        // Expected Results:
        // - User is automatically redirected away from login page
        // - User lands on the dashboard or home page
        // - No login form is shown to authenticated users
        await expect(adminPage).toHaveURL(/.*\//, { timeout: 10000 });
        await expect(adminPage.locator("body")).not.toContainText("Sign in");
    });
});
