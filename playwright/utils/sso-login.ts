import type { Page } from "@playwright/test";
import type { TestUser } from "../fixtures/users.config";

/**
 * Performs SSO login through the real login flow:
 * 1. Navigate to the dashboard login page
 * 2. Enter email in the SSO email form
 * 3. Submit → redirects to identity provider (Keycloak/Auth0)
 * 4. Fill in credentials on the IdP login page
 * 5. IdP redirects back to dashboard
 */
export async function ssoLogin(page: Page, user: TestUser, baseUrl: string): Promise<void> {
    const dashboardOrigin = new URL(baseUrl).origin;

    // Step 1: Go to the dashboard login page
    await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });

    // Wait for either: the login form to appear, or a redirect to the dashboard
    // (if already authenticated, SSO auto-redirect completes on the dashboard origin)
    const emailField = page.locator('input[type="email"]').first();
    const result = await Promise.race([
        emailField.waitFor({ state: "visible", timeout: 30000 }).then(() => "login-form" as const),
        page
            .waitForURL((url) => url.origin === dashboardOrigin && !url.pathname.includes("/login"), { timeout: 30000 })
            .then(() => "already-authed" as const)
    ]);

    if (result === "already-authed") {
        return; // SSO auto-redirect completed, user is already logged in
    }

    // Step 2: Enter email in the SSO email form and submit
    await emailField.fill(user.email);

    const submitButton = page.locator('form button[type="submit"]');
    await submitButton.click();

    // Step 3: Wait for redirect — either to an external IdP or via server-side SSO redirect
    // The SSO flow may complete entirely on the dashboard origin (via post-sso-redirect)
    const postSubmitResult = await Promise.race([
        page
            .waitForURL((url) => url.origin !== dashboardOrigin, { timeout: 30000 })
            .then(() => "external-idp" as const),
        page
            .waitForURL((url) => url.origin === dashboardOrigin && !url.pathname.includes("/login"), { timeout: 30000 })
            .then(() => "server-side-sso" as const)
    ]);

    if (postSubmitResult === "server-side-sso") {
        return; // SSO completed server-side, already on dashboard
    }

    // Step 4: Fill in credentials on the external IdP login page (Keycloak / Auth0 / etc.)
    const idpEmail = page.locator('#username, input[name="username"], input[name="email"]').first();
    const idpPassword = page.locator('#password, input[name="password"], input[type="password"]').first();

    await idpEmail.waitFor({ timeout: 15000 });
    await idpEmail.fill(user.email);
    await idpPassword.fill(user.password);

    // Submit — Keycloak: #kc-login, Auth0/generic: button[type="submit"]
    await page.locator('#kc-login, button[type="submit"], input[type="submit"]').first().click();

    // Step 5: Wait for redirect back to the dashboard
    await page.waitForURL((url) => url.origin === dashboardOrigin && !url.pathname.includes("/login"), {
        timeout: 60000
    });
}
