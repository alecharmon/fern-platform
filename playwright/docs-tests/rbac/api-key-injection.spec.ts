import { expect, test } from "@playwright/test";
import { DOCS_URL, loginWithPassword, PASSWORDS, type RoleKey } from "./helpers";

const API_KEY_INJECTION_ENDPOINT = `${DOCS_URL}/api/fern-docs/auth/api-key-injection`;

test.describe("API Key Injection RBAC Behavior", () => {
    test("unauthenticated session does not expose injected credentials", async ({ page }) => {
        await page.context().clearCookies();

        const response = await page.request.get(API_KEY_INJECTION_ENDPOINT);
        expect(response.ok()).toBeTruthy();

        const payload = await response.json();
        expect(payload.enabled).toBe(false);
        expect(payload.authenticated).not.toBe(true);
        expect(payload.access_token).toBeUndefined();
        expect(payload.authorizationUrl).toBeUndefined();
    });

    const roles: RoleKey[] = ["admin", "developer", "partner", "adminDev", "all"];

    for (const role of roles) {
        test(`${role} role session does not expose injected credentials`, async ({ page }) => {
            await loginWithPassword(page, PASSWORDS[role]);

            const response = await page.request.get(API_KEY_INJECTION_ENDPOINT);
            expect(response.ok()).toBeTruthy();

            const payload = await response.json();
            expect(payload.enabled).toBe(false);
            expect(payload.authenticated).not.toBe(true);
            expect(payload.access_token).toBeUndefined();
            expect(payload.authorizationUrl).toBeUndefined();
        });
    }
});
