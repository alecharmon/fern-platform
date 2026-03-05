import { test as base, Page } from "@playwright/test";
import { env } from "../utils/env";

export interface AuthFixtures {
    /**
     * Pre-authenticated page on the dashboard.
     *
     * Uses the storageState saved by auth.setup.ts, so no login
     * is performed — the page is already authenticated.
     */
    homePage: Page;

    /**
     * The org name extracted from the dashboard URL after login redirect.
     */
    orgName: string;
}

export const test = base.extend<AuthFixtures>({
    homePage: async ({ page }, use) => {
        // storageState is already loaded at the project level from auth.setup.ts,
        // so we just navigate to the dashboard — no login needed.
        await page.goto(env.dashboardUrl);
        // Wait for redirect to an org page (e.g., /{orgName}/docs/...)
        await page.waitForURL(
            (url) => url.pathname.split("/").filter(Boolean).length >= 1 && url.pathname !== "/",
            { timeout: 30000 }
        );
        await use(page);
    },

    orgName: async ({ page }, use) => {
        await page.goto(env.dashboardUrl);
        // Wait for redirect to org page: /{orgName}/docs/...
        await page.waitForURL((url) => url.pathname.split("/").filter(Boolean).length >= 1 && url.pathname !== "/", {
            timeout: 30000
        });
        const url = new URL(page.url());
        const orgName = url.pathname.split("/").filter(Boolean)[0];
        if (!orgName) {
            throw new Error(`Could not extract org name from URL: ${page.url()}`);
        }
        await use(orgName);
    }
});

export { expect } from "@playwright/test";
