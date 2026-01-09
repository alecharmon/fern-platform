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
     * CI testing secret - must match FERN_CI_AUTOMATED_TESTING on dashboard
     */
    ciTestingSecret: process.env.FERN_CI_AUTOMATED_TESTING ?? ""
};
