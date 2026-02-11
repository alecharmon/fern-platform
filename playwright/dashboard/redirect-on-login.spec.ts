import { test as base, expect, type Page } from "@playwright/test";
import { getTestUser, type UserRole } from "../fixtures/users.config";
import { env } from "../utils/env";

/**
 * Tests for the redirect_on_login cookie functionality.
 *
 * This tests the bug fix where cookie deletion was moved to a server action
 * to comply with Next.js 15 requirements (cookies can only be modified in
 * Server Actions or Route Handlers).
 *
 * The redirect_on_login cookie is set during invitation flows to redirect
 * users to a specific org after they complete authentication.
 */

interface RedirectOnLoginFixtures {
    /**
     * Login with a redirect_on_login cookie set
     */
    loginWithRedirectCookie: (role: UserRole, redirectPath: string) => Promise<{ page: Page; redirectPath: string }>;
}

const test = base.extend<RedirectOnLoginFixtures>({
    loginWithRedirectCookie: async ({ browser }, use) => {
        const pages: Page[] = [];

        const login = async (role: UserRole, redirectPath: string): Promise<{ page: Page; redirectPath: string }> => {
            const user = getTestUser(role);
            if (!user) {
                throw new Error(`No test user configured for role: ${role}. Check FERN_CI_AUTOMATED_TESTING env var.`);
            }

            const context = await browser.newContext();
            const page = await context.newPage();

            // Navigate to login with CI testing param
            const loginUrl = `${env.dashboardUrl}/login?FERN_CI_AUTOMATED_TESTING=${encodeURIComponent(env.ciTestingSecret)}`;
            await page.goto(loginUrl);

            // Set the redirect_on_login cookie after page load (works better with localhost)
            await page.evaluate((path) => {
                document.cookie = `redirect_on_login=${encodeURIComponent(path)}; path=/`;
            }, redirectPath);

            // Fill in CI test login form
            await page.fill('[data-testid="ci-email-input"]', user.email);
            await page.fill('[data-testid="ci-password-input"]', user.password);
            await page.click('[data-testid="ci-submit-button"]');

            // Wait for login to complete and redirect chain to start
            // The flow is: submit -> Auth0 -> callback -> / -> middleware redirect
            await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 100000 });

            pages.push(page);
            return { page, redirectPath };
        };

        await use(login);

        // Cleanup
        for (const page of pages) {
            await page.context().close();
        }
    }
});

test.describe("Redirect on Login Cookie", () => {
    test("does not redirect when redirect_on_login cookie is not set", async ({ browser }) => {
        const user = getTestUser("admin");
        if (!user) {
            throw new Error("No test user configured for admin role");
        }

        const context = await browser.newContext();
        const page = await context.newPage();

        // Login without setting the redirect cookie
        const loginUrl = `${env.dashboardUrl}/login?FERN_CI_AUTOMATED_TESTING=${encodeURIComponent(env.ciTestingSecret)}`;
        await page.goto(loginUrl);

        await page.fill('[data-testid="ci-email-input"]', user.email);
        await page.fill('[data-testid="ci-password-input"]', user.password);
        await page.click('[data-testid="ci-submit-button"]');

        // Should redirect to default dashboard behavior (not /get-started specifically from cookie)
        // Wait for any redirect to complete
        await page.waitForURL("**/", { timeout: 30000 });

        // Verify we're on the dashboard root or org page, not a specific cookie-driven redirect
        const url = page.url();
        // The page should either be at root, org page, or get-started (default flow), but NOT because of cookie
        expect(url).toMatch(/\/(org\/|get-started|$)/);

        await context.close();
    });

    test("cookie is consumed even when redirect target requires additional navigation", async ({
        loginWithRedirectCookie
    }) => {
        // Test with a path that will trigger additional redirects (e.g., due to permissions)
        // The cookie should still be consumed by middleware on the initial "/" landing
        const targetPath = "/settings";
        const { page } = await loginWithRedirectCookie("admin", targetPath);

        // Wait for the redirect chain to complete
        // The flow is: login -> / (middleware consumes cookie, redirects) -> /settings (or elsewhere)
        await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 30000 });
        await page.waitForLoadState("load");

        // The cookie should be consumed regardless of where we end up
        const cookies = await page.context().cookies();
        const redirectCookie = cookies.find((c) => c.name === "redirect_on_login");
        expect(redirectCookie).toBeUndefined();
    });
});
