export const env = {
    /**
     * Dashboard URL to test against
     */
    dashboardUrl: process.env.DASHBOARD_URL ?? "https://dashboard.buildwithfern.com",

    /**
     * Organization slug the test user lands on after login
     */
    orgSlug: process.env.ORG_SLUG ?? "sso-test-org",

    /**
     * Docs URL to test against (future use)
     */
    docsUrl: process.env.DOCS_URL ?? "http://localhost:3000",

    /**
     * Whether to use automated SSO login (with test user credentials)
     * vs manual login (headed mode with saved auth state).
     *
     * Defaults to true — set PLAYWRIGHT_MANUAL_AUTH=1 to force manual mode,
     * e.g. when running `pnpm e2e:headed` and wanting to log in interactively.
     */
    get useAutomatedAuth(): boolean {
        return !process.env.PLAYWRIGHT_MANUAL_AUTH;
    }
};
