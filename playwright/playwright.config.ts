import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Load .env.local - check playwright dir first, then root
dotenv.config({ path: path.resolve(__dirname, ".env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { AUTH_STATE_PATH } from "./utils/auth-state";
import { env } from "./utils/env";

/**
 * Playwright configuration with manual login support.
 *
 * The "setup" project runs first to authenticate (manually in headed mode,
 * or automatically in CI). It saves browser state to .auth/state.json.
 * All other projects depend on "setup" and reuse that saved state, so
 * every test starts already logged in without needing to log in again.
 *
 * To run locally with manual login:
 *   pnpm e2e:headed
 *
 * The browser will open the login page and pause. Log in manually,
 * then click "Resume" in the Playwright inspector. All subsequent
 * tests will use your authenticated session.
 */
export default defineConfig({
    testDir: ".",
    testMatch: ["dashboard/**/*.spec.ts", "docs/**/*.spec.ts"],
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 10,
    reporter: process.env.CI
        ? [["github"], ["html", { open: "never" }], ["list"]]
        : [["html", { open: "never" }], ["list"]],

    use: {
        baseURL: env.dashboardUrl,
        trace: "on-first-retry",
        screenshot: "only-on-failure"
    },

    projects: [
        // Setup project: runs first to authenticate and save state
        {
            name: "setup",
            testMatch: "auth.setup.ts"
        },

        // Chromium tests: depend on setup, use saved auth state
        {
            name: "chromium",
            use: {
                ...devices["Desktop Chrome"],
                storageState: AUTH_STATE_PATH
            },
            dependencies: ["setup"]
        },

        // Firefox tests: only in CI, depend on setup, use saved auth state
        ...(process.env.CI
            ? [
                  {
                      name: "firefox",
                      use: {
                          ...devices["Desktop Firefox"],
                          storageState: AUTH_STATE_PATH
                      },
                      dependencies: ["setup"]
                  }
              ]
            : [])
    ]
});
