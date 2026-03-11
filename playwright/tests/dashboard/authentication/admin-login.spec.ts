import { expect, test } from "@playwright/test";
import { AUTH_STATE_PATH } from "../../../utils/auth-state";
import { env } from "../../../utils/env";

test.describe("Authentication", () => {
    test.use({ storageState: AUTH_STATE_PATH });

    test("Admin Login via SSO", async ({ page }) => {
        // Navigate directly to the org page with saved auth state
        await page.goto(`${env.dashboardUrl}/${env.orgSlug}/`);

        await page.waitForURL((url) => url.pathname.startsWith(`/${env.orgSlug}`), { timeout: 30000 });

        // Verify user is on the correct org dashboard, not a sign-in page
        await expect(page.locator("body")).not.toContainText("Sign in");
        expect(page.url()).toContain(`/${env.orgSlug}`);
    });
});
