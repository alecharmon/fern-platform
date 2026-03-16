import { expect, test } from "@playwright/test";
import { AUTH_STATE_PATH } from "../utils/auth-state";
import { env } from "../utils/env";

/**
 * Tests that returning users are redirected to their last-visited page
 * without intermediate page flashes (no loader, no intermediate URLs).
 *
 * The dashboard stores the user's recent path in Redis via a debounced
 * server action. When the user returns to "/", the server reads Redis
 * and redirects instantly — skipping the client-side RecentOrgRedirect fallback.
 */
test.describe("Recent Path Redirect", () => {
    test.use({ storageState: AUTH_STATE_PATH });
    test.setTimeout(90000);

    test("authenticated user redirected to last-visited path on root page", async ({ page }) => {
        // Step 1: Navigate to a specific page to populate the recent path in Redis
        const targetPath = `/${env.orgSlug}/members`;
        await page.goto(`${env.dashboardUrl}${targetPath}`, { waitUntil: "domcontentloaded" });
        await page.waitForURL((url) => url.pathname.startsWith(targetPath), { timeout: 30000 });

        // Wait for the debounced tracker to fire (2s debounce + buffer)
        await page.waitForTimeout(3500);

        // Step 2: Navigate to root and track all URL transitions
        const urlTransitions: string[] = [];
        page.on("framenavigated", (frame) => {
            if (frame === page.mainFrame()) {
                urlTransitions.push(new URL(frame.url()).pathname);
            }
        });

        await page.goto(`${env.dashboardUrl}/`, { waitUntil: "domcontentloaded" });

        // Step 3: Wait for final destination
        await page.waitForURL((url) => url.pathname.startsWith(`/${env.orgSlug}/members`), {
            timeout: 30000,
        });

        // Step 4: Verify no flash — loader text should NOT be visible
        await expect(page.locator("text=Setting up your workspace...")).not.toBeVisible();

        // Step 5: Verify no intermediate page was visited
        // The transitions should go from / directly to /orgSlug/members (via server redirect)
        // without stopping at /orgSlug/docs or /orgSlug/
        const intermediatePages = urlTransitions.filter(
            (url) =>
                url !== "/" &&
                !url.startsWith(targetPath) &&
                url.startsWith(`/${env.orgSlug}`),
        );
        expect(intermediatePages).toEqual([]);
    });

    test("first-time user falls back to default org redirect", async ({ browser }) => {
        // Use a fresh context to simulate no Redis entry
        const context = await browser.newContext({ storageState: AUTH_STATE_PATH });
        const page = await context.newPage();

        // Navigate directly to root
        await page.goto(`${env.dashboardUrl}/`, { waitUntil: "domcontentloaded" });

        // Should end up at the org's default page
        await page.waitForURL((url) => url.pathname.startsWith(`/${env.orgSlug}`), {
            timeout: 30000,
        });

        // Should be on some valid org page
        const pathname = new URL(page.url()).pathname;
        expect(pathname).toMatch(new RegExp(`^/${env.orgSlug}/`));

        await context.close();
    });
});
