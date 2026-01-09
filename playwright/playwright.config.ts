import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Load .env.local - check playwright dir first, then root
dotenv.config({ path: path.resolve(__dirname, ".env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { env } from "./utils/env";

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

    // Locally: just chromium for speed
    projects: process.env.CI
        ? [
              { name: "chromium", use: { ...devices["Desktop Chrome"] } },
              { name: "firefox", use: { ...devices["Desktop Firefox"] } }
          ]
        : [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
