import { test as setup } from "@playwright/test";
import fs from "fs";
import { getTestUser } from "./fixtures/users.config";
import { AUTH_STATE_PATH } from "./utils/auth-state";
import { env } from "./utils/env";
import { ssoLogin } from "./utils/sso-login";

/**
 * Authentication setup — runs once before all tests.
 *
 * Automated mode: logs in as admin via the SSO flow and saves browser state.
 * Manual mode (PLAYWRIGHT_MANUAL_AUTH=1): opens login page and pauses for
 * interactive login, then saves state.
 *
 * Saved state is reused across all test projects via storageState, and
 * persists across runs. Delete .auth/state.json to force a fresh login.
 */
setup("authenticate", async ({ page }) => {
    setup.setTimeout(120000);

    // Reuse existing auth state if available and still valid
    // In manual mode, always do a fresh login so the user gets the login prompt
    if (env.useAutomatedAuth && fs.existsSync(AUTH_STATE_PATH)) {
        const context = page.context();
        await context.addCookies(JSON.parse(fs.readFileSync(AUTH_STATE_PATH, "utf-8")).cookies ?? []);
        await page.goto(env.dashboardUrl, { waitUntil: "domcontentloaded" });

        // Check if we're redirected to login (state expired)
        await page.waitForTimeout(3000);
        const url = new URL(page.url());
        const isLoggedIn = url.origin === new URL(env.dashboardUrl).origin && !url.pathname.includes("/login");

        if (isLoggedIn) {
            // Saved state is still valid — re-save and exit
            await page.context().storageState({ path: AUTH_STATE_PATH });
            return;
        }
        // State expired, fall through to fresh login
    }

    if (env.useAutomatedAuth) {
        // Automated: SSO login with test credentials
        const user = getTestUser("admin");
        await ssoLogin(page, user, env.dashboardUrl);
    } else {
        // Manual: open login page and let the user log in interactively
        await page.goto(`${env.dashboardUrl}/login`);
        await page.pause();

        const dashboardOrigin = new URL(env.dashboardUrl).origin;
        await page.waitForURL((url) => url.origin === dashboardOrigin && !url.pathname.includes("/login"), {
            timeout: 60000
        });
    }

    // Save authentication state for reuse by all test projects (and future runs)
    await page.context().storageState({ path: AUTH_STATE_PATH });
});
