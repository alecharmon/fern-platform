import { defineConfig } from "checkly";
import { Frequency } from "checkly/constructs";

export default defineConfig({
    projectName: "Fern Dashboard Playwright Monitoring",
    logicalId: "fern-dashboard-playwright-monitoring",
    repoUrl: "https://github.com/fern-api/fern-platform",
    checks: {
        playwrightConfigPath: "./playwright/playwright.config.ts",
        locations: ["us-east-1"],
        playwrightChecks: [
            {
                name: "Dashboard Playwright Suite",
                logicalId: "dashboard-playwright-suite",
                pwProjects: ["checkly:dashboard"],
                installCommand: "pnpm install --frozen-lockfile",
                frequency: Frequency.EVERY_30M
            },
            {
                name: "Customer Production Site Checks",
                logicalId: "customer-production-site-checks",
                pwProjects: ["checkly:customer-smoke"],
                installCommand: "pnpm install --frozen-lockfile",
                frequency: Frequency.EVERY_5M,
                locations: ["us-east-1", "eu-west-1"]
            }
        ]
    },
    cli: {
        runLocation: "us-east-1",
        retries: 0
    }
});
