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
 * Two modes:
 * - Headed (no credentials): opens the Playwright inspector for manual login
 * - Automated (default): uses E2E_TEST_EMAIL/E2E_TEST_PASSWORD (defaults to
 *   alice@acme.com / buildwithfern) to log in via the email form → Auth0 flow
 */
setup("authenticate", async ({ page }) => {
    setup.setTimeout(120000);

    const dashboardOrigin = new URL(env.dashboardUrl).origin;

    // Reuse existing auth state if available
    if (fs.existsSync(AUTH_STATE_PATH)) {
        const context = page.context();
        await context.addCookies(JSON.parse(fs.readFileSync(AUTH_STATE_PATH, "utf-8")).cookies ?? []);
        await page.goto(env.dashboardUrl, { waitUntil: "domcontentloaded" });

        // Check if we're redirected to login (state expired)
        await page.waitForTimeout(3000);
        const url = new URL(page.url());
        const isLoggedIn = url.origin === dashboardOrigin && !url.pathname.includes("/login");

        if (isLoggedIn) {
            await page.context().storageState({ path: AUTH_STATE_PATH });
            return;
        }
        // State expired, fall through to fresh login
    }

    if (env.testEmail && env.testPassword) {
        // Automated login via the dashboard email form → Auth0 flow
        await page.goto(`${env.dashboardUrl}/login`, { waitUntil: "domcontentloaded" });

        // Step 1: Fill email in the dashboard login form and submit
        await page.fill('input[type="email"]', env.testEmail);
        await page.click('button[type="submit"]');

        // Step 2: Wait for Auth0 Universal Login page to load
        await page.waitForURL(/auth0|authorize/, { timeout: 30000 });

        // Step 3: Fill password on the Auth0 login page and submit
        await page.fill('input[type="password"]', env.testPassword);
        await page.click('button[type="submit"]');
    } else {
        // Manual mode: open login page and pause for the user to log in
        await page.goto(`${env.dashboardUrl}/login`);
        await page.pause();
    }

    // Wait for redirect back to the dashboard (past the login page)
    await page.waitForURL(
        (url) => url.origin === dashboardOrigin && !url.pathname.includes("/login"),
        { timeout: 60000 }
    );

    // Save authentication state for reuse by all tests in this run
    await page.context().storageState({ path: AUTH_STATE_PATH });
});
