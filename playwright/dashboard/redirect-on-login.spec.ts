import { expect, test } from "@playwright/test";
import { AUTH_STATE_PATH } from "../utils/auth-state";
import { env } from "../utils/env";

/**
 * Tests for the redirect_on_login cookie functionality.
 *
 * Uses saved auth state so the server-side SSO redirect completes
 * automatically when navigating to /login.
 */

test.describe
    .serial("Redirect on Login Cookie", () => {
        test.use({ storageState: AUTH_STATE_PATH });
        test.setTimeout(90000);

        test("does not redirect when redirect_on_login cookie is not set", async ({ page }) => {
            // Navigate directly to org page — should stay on org page
            await page.goto(`${env.dashboardUrl}/${env.orgSlug}/`);

            await page.waitForURL((url) => url.pathname.startsWith(`/${env.orgSlug}`), { timeout: 30000 });

            expect(new URL(page.url()).pathname).not.toContain("/login");
        });

        test("cookie is consumed after login", async ({ browser }) => {
            const dashboardUrl = new URL(env.dashboardUrl);
            const redirectTarget = `/${env.orgSlug}/members`;

            // Create context with saved auth state + redirect cookie
            const context = await browser.newContext({ storageState: AUTH_STATE_PATH });
            await context.addCookies([
                {
                    name: "redirect_on_login",
                    value: encodeURIComponent(redirectTarget),
                    domain: dashboardUrl.hostname,
                    path: "/"
                }
            ]);
            const page = await context.newPage();

            // Navigate to org page — cookie should be consumed during page load
            await page.goto(`${env.dashboardUrl}/${env.orgSlug}/`);

            // Wait for page to settle (may redirect to the cookie target or stay on org page)
            await page.waitForURL((url) => url.pathname.startsWith(`/${env.orgSlug}`), { timeout: 30000 });

            // The cookie should be consumed regardless of where we end up
            const cookies = await context.cookies();
            const redirectCookie = cookies.find((c) => c.name === "redirect_on_login");
            expect(redirectCookie).toBeUndefined();

            await context.close();
        });
    });
