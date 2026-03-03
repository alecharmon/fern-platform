import { defineConfig, devices } from "@playwright/test";

/**
 * Fern Dev Tests - Playwright Configuration
 *
 * All test logic lives here and in the test files. The GitHub Actions workflow
 * simply runs `npx playwright test` — no test logic in CI YAML.
 *
 * To run locally:
 *   cd fern-dev-tests
 *   npx playwright install chromium
 *   npx playwright test
 *
 * To run a specific test file:
 *   npx playwright test tests/docs-visual-regression.spec.ts
 *
 * To update baselines:
 *   UPDATE_BASELINES=true npx playwright test
 */
export default defineConfig({
    testDir: "./tests",
    testMatch: "**/*.spec.ts",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 4 : undefined,
    reporter: process.env.CI
        ? [["github"], ["html", { open: "never" }], ["list"]]
        : [["html", { open: "never" }], ["list"]],
    timeout: 60_000,

    use: {
        trace: "on-first-retry",
        screenshot: "only-on-failure"
    },

    projects: [
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
                viewport: { width: 1440, height: 900 }
            }
        }
    ]
});
