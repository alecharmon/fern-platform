import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

import { AUTH_STATE_PATH } from "./utils/auth-state";

// Load .env.local - check playwright dir first, then root
dotenv.config({ path: path.resolve(__dirname, ".env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const baseURL = process.env.DASHBOARD_URL ?? "https://dashboard.buildwithfern.com";
const isLocalDashboard = baseURL.startsWith("http://localhost:") || baseURL === "http://localhost";
const isCheckly = process.env.CHECKLY === "1";
const workers = isLocalDashboard ? 1 : 2;
if (!process.env._PW_URL_PRINTED) {
    process.env._PW_URL_PRINTED = "1";
}

/**
 * Playwright config with SSO auth setup.
 *
 * The "setup" project runs first — one worker authenticates via SSO
 * (or manually in headed mode) and saves browser state to .auth/state.json.
 * All test projects reuse that saved state so every test starts logged in.
 *
 * Automated: `pnpm e2e` — logs in as alice@acme.com via SSO
 * Manual:    `PLAYWRIGHT_MANUAL_AUTH=1 pnpm e2e:headed` — interactive login
 */
export default defineConfig({
    testDir: ".",
    testMatch: isCheckly
        ? ["dashboard/**/*.spec.ts", "docs/**/*.spec.ts", "checks/**/*.spec.ts"]
        : ["dashboard/**/*.spec.ts", "docs/**/*.spec.ts"],
    fullyParallel: !isLocalDashboard,
    forbidOnly: !!process.env.CI,
    retries: isCheckly ? 5 : process.env.CI ? 2 : 1,
    workers,
    timeout: 60000,
    reporter: process.env.CI
        ? [["github"], ["html", { open: "never" }], ["list"]]
        : [["html", { open: "never" }], ["list"]],

    use: {
        baseURL,
        trace: "on-first-retry",
        screenshot: "only-on-failure",
        video: "retain-on-failure"
    },

    projects: [
        {
            name: "setup",
            testMatch: "auth.setup.ts"
        },
        {
            name: "checkly:dashboard",
            testIgnore: ["**/sso-org-provisioning.spec.ts", "checks/**"],
            use: {
                ...devices["Desktop Chrome"],
                storageState: AUTH_STATE_PATH
            },
            dependencies: ["setup"]
        },
        // Customer smoke tests only run in Checkly (requires generated sites.ts)
        ...(isCheckly
            ? [
                  {
                      name: "checkly:customer-smoke",
                      testMatch: "checks/**/*.spec.ts",
                      testIgnore: [] as string[],
                      timeout: 300_000
                  }
              ]
            : []),

        // Chromium tests: depend on setup, use saved auth state
        {
            name: "chromium",
            testIgnore: ["checks/**"],
            use: {
                ...devices["Desktop Chrome"],
                storageState: AUTH_STATE_PATH
            },
            dependencies: ["setup"]
        }
    ]
});
