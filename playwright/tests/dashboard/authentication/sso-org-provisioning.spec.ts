import { expect, test } from "@playwright/test";
import { getTestUser } from "../../../fixtures/users.config";
import { env } from "../../../utils/env";

test.describe("Authentication", () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    test.setTimeout(120000);

    test("SSO login provisions first-time user into configured org", async ({ browser }) => {
        const user = getTestUser("admin");
        const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
        const page = await context.newPage();

        try {
            await page.goto(`${env.dashboardUrl}/login`, { waitUntil: "networkidle" });
            const emailField = page.locator('input[type="email"]').first();
            await expect(emailField).toBeVisible();
            await emailField.fill(user.email);
            await page.locator('form button[type="submit"]').click();

            const idpEmail = page.locator('#username, input[name="username"], input[name="email"]').first();
            const idpPassword = page.locator('#password, input[name="password"], input[type="password"]').first();

            await idpEmail.waitFor({ timeout: 30000 });
            await idpEmail.fill(user.email);
            await idpPassword.fill(user.password);
            await page.locator('#kc-login, button[type="submit"], input[type="submit"]').first().click();

            await page.waitForURL(
                (url) =>
                    url.origin === env.dashboardUrl &&
                    url.pathname.startsWith(`/${env.orgSlug}`) &&
                    !url.pathname.startsWith(`/${env.orgSlug}/${env.orgSlug}`),
                {
                    timeout: 90000
                }
            );

            const organizations = await page.evaluate(async (dashboardUrl) => {
                const response = await fetch(`${dashboardUrl}/api/get-my-organizations`, {
                    credentials: "include"
                });
                return await response.json();
            }, env.dashboardUrl);

            const finalUrl = new URL(page.url());

            expect(finalUrl.origin).toBe(env.dashboardUrl);
            expect(finalUrl.pathname.startsWith(`/${env.orgSlug}`)).toBe(true);
            expect(finalUrl.pathname.startsWith(`/${env.orgSlug}/${env.orgSlug}`)).toBe(false);
            expect(Array.isArray(organizations)).toBe(true);
            expect(organizations).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        name: env.orgSlug
                    })
                ])
            );
        } finally {
            await context.close().catch(() => undefined);
        }
    });
});
