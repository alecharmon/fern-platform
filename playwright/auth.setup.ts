import { test as setup } from "@playwright/test";
import fs from "fs";
import { AUTH_STATE_PATH } from "./utils/auth-state";
import { env } from "./utils/env";

/**
 * Authentication setup.
 *
 * Saves browser state to .auth/state.json so all tests start logged in.
 *
 * If a saved state already exists (from a previous run), reuses it to
 * avoid re-authenticating every time. Delete .auth/state.json to force
 * a fresh login.
 *
 * In CI, uses automated CI credential login.
 * Locally, opens the Playwright inspector for manual login (if no saved state).
 */
setup("authenticate", async ({ page }) => {
    setup.setTimeout(120000);

    // Reuse existing auth state if available
    if (fs.existsSync(AUTH_STATE_PATH)) {
        // Validate saved state still works by loading it and hitting the dashboard
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

    if (env.ciTestingSecret) {
        // CI mode: automated login with test credentials
        const loginUrl = `${env.dashboardUrl}/login?FERN_CI_AUTOMATED_TESTING=${encodeURIComponent(env.ciTestingSecret)}`;
        await page.goto(loginUrl);

        // Wait for either the CI form or a redirect back to the dashboard
        // (e.g., if an existing Google session auto-completes the OAuth flow)
        const ciForm = page.locator('[data-testid="ci-email-input"]');
        const dashboardOrigin = new URL(env.dashboardUrl).origin;
        const dashboardLoaded = page.waitForURL(
            (url) => url.origin === dashboardOrigin && !url.pathname.includes("/login"),
            { timeout: 100000 }
        );

        const result = await Promise.race([
            ciForm.waitFor({ timeout: 100000 }).then(() => "ci-form" as const),
            dashboardLoaded.then(() => "dashboard" as const)
        ].map(p => p.catch(() => null))).then(r => r ?? "dashboard");

        if (result === "ci-form") {
            await page.fill('[data-testid="ci-email-input"]', "ci-admin@buildwithfern.com");
            await page.fill('[data-testid="ci-password-input"]', env.ciTestingSecret);
            await page.click('[data-testid="ci-submit-button"]');
        }
    } else {
        // Manual mode: open login page and let the user log in
        await page.goto(`${env.dashboardUrl}/login`);

        // Pause so the user can manually log in.
        // In headed mode this opens the Playwright inspector.
        // Once logged in, click "Resume" in the inspector to continue.
        await page.pause();
    }

    // Wait for dashboard to load (past the login page)
    const dashboardOrigin = new URL(env.dashboardUrl).origin;
    await page.waitForURL((url) => url.origin === dashboardOrigin && !url.pathname.includes("/login"), {
        timeout: 60000
    });

    // Save authentication state for reuse by all test projects (and future runs)
    await page.context().storageState({ path: AUTH_STATE_PATH });
});
