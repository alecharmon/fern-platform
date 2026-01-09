// spec: Authentication - Logout Flow
// seed: dashboard/seed.spec.ts

import { expect, test } from "../../../fixtures/auth.fixture";
import { env } from "../../../utils/env";

test.describe("Authentication", () => {
    test("Logout Flow", async ({ homePage: adminPage }) => {
        // 1. Login as admin user using CI credentials (already done by adminPage fixture)
        // Verify we're on the dashboard after login
        await expect(adminPage).toHaveURL(/.*\//);

        // 2. Verify successful login and dashboard display
        await expect(adminPage.locator("body")).not.toContainText("Log in to Fern");

        // 3. Locate and click user profile button (avatar in top right)
        // The profile button is a Radix UI Popover trigger with user's email as accessible name
        // Look for a button containing an image with the user's email in the alt text
        const userMenuButton = adminPage.getByRole("button").filter({
            has: adminPage.locator('img[alt*="@buildwithfern.com"]')
        });

        await userMenuButton.click();

        // 4. Click logout button
        // The logout button is a Button component with a link to /api/logout containing "Logout" text
        const logoutButton = adminPage.getByRole("link", { name: "Logout" });

        await logoutButton.click();

        // 5. Wait for redirect to login page
        await adminPage.waitForURL(/.*\/login/, { timeout: 10000 });

        // Expected Results:
        // - User session is terminated
        // - User is redirected to login page
        await expect(adminPage).toHaveURL(/.*\/login/);
        await expect(adminPage.locator("body")).toContainText("Log in to Fern");

        // - Attempting to access protected pages redirects back to login
        await adminPage.goto(env.dashboardUrl);
        await adminPage.waitForURL(/.*\/login/, { timeout: 10000 });
        await expect(adminPage).toHaveURL(/.*\/login/);

        // - No user data is accessible after logout
        // Verify we're still on the login page and not authenticated
        await expect(adminPage.locator("body")).toContainText("Log in to Fern");
    });
});
