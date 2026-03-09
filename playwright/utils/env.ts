export const env = {
    /**
     * Dashboard URL to test against
     */
    dashboardUrl: process.env.DASHBOARD_URL ?? "http://localhost:3001",

    /**
     * Docs URL to test against (future use)
     */
    docsUrl: process.env.DOCS_URL ?? "http://localhost:3000",

    /**
     * Test user email for automated login
     */
    testEmail: process.env.E2E_TEST_EMAIL || "alice@acme.com",

    /**
     * Test user password for automated login
     */
    testPassword: process.env.E2E_TEST_PASSWORD || "buildwithfern"
};
