/**
 * Clickjacking protection tests for Fern Dashboard
 *
 * Tests verify that X-Frame-Options and CSP frame-ancestors headers prevent iframe embedding.
 *
 * SETUP REQUIRED:
 * 1. Start dashboard dev server: cd packages/fern-dashboard && pnpm dev
 * 2. Set DASHBOARD_URL env var if testing against non-default: export DASHBOARD_URL=http://localhost:3001
 * 3. Run tests: pnpm --filter playwright test tests/dashboard/security/clickjacking-protection.spec.ts
 *
 * Default DASHBOARD_URL: http://localhost:3001 (see playwright/utils/env.ts)
 */
import { expect, test } from "@playwright/test";

import { env } from "../../../utils/env";

test.describe("Clickjacking Protection", () => {
    test("should return X-Frame-Options: DENY header on login page", async ({ page }) => {
        const response = await page.goto(env.dashboardUrl + "/login");
        expect(response).not.toBeNull();

        const xFrameOptions = response?.headers()["x-frame-options"];
        expect(xFrameOptions).toBe("DENY");
    });

    test("should return frame-ancestors 'none' in CSP header", async ({ page }) => {
        const response = await page.goto(env.dashboardUrl + "/login");
        expect(response).not.toBeNull();

        const csp = response?.headers()["content-security-policy"];
        expect(csp).toContain("frame-ancestors 'none'");
    });

    test("should block dashboard from being embedded in iframe", async ({ page, baseURL }) => {
        // Create page with iframe embedding attempt
        const iframeHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Clickjacking Attack Simulation</title>
            </head>
            <body>
                <h1>Attempting to embed dashboard</h1>
                <iframe id="test-frame" src="${baseURL}/login" width="500" height="500"></iframe>
            </body>
            </html>
        `;

        await page.goto(`data:text/html,${encodeURIComponent(iframeHTML)}`);

        // Wait for iframe element to be attached
        const iframe = page.locator("#test-frame");
        await expect(iframe).toBeAttached();

        // Get the frame locator and try to find content inside
        // Due to X-Frame-Options: DENY, the iframe content should be blocked
        const frameLocator = page.frameLocator("#test-frame");

        // Try to locate an element that would exist if the login page loaded
        // The page should be blocked, so this element should not be visible
        const loginContent = frameLocator.locator("body");

        // X-Frame-Options: DENY should prevent the iframe from rendering content
        // We verify by checking that we cannot interact with iframe content
        // The frame should either be empty or blocked by the browser
        await expect(async () => {
            const count = await loginContent.count();
            // If blocked, either count is 0 or the frame is inaccessible
            // Some browsers may still show an error page, so we check if actual login content loaded
            if (count > 0) {
                // Check if login form elements exist - they shouldn't if blocked
                const loginForm = frameLocator.locator(
                    'form, [data-testid="login"], input[type="email"], input[type="password"]'
                );
                const formCount = await loginForm.count();
                expect(formCount, "Login form should not be accessible in blocked iframe").toBe(0);
            }
        }).toPass({ timeout: 5000 });
    });

    test("should protect all dashboard routes with X-Frame-Options", async ({ page }) => {
        const routes = ["/login", "/"];

        for (const route of routes) {
            const response = await page.goto(env.dashboardUrl + route);

            // Some routes may redirect, check final response
            if (response) {
                const xFrameOptions = response.headers()["x-frame-options"];
                expect(xFrameOptions, `Route ${route} should have X-Frame-Options header`).toBe("DENY");
            }
        }
    });
});
