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
     * CI test user email
     */
    ciEmail: process.env.E2E_TEST_EMAIL ?? "",

    /**
     * CI test user password
     */
    ciPassword: process.env.E2E_TEST_PASSWORD ?? ""
};
