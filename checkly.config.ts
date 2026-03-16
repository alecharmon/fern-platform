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
                pwProjects: ["checkly"],
                installCommand: "pnpm install --frozen-lockfile",
                frequency: Frequency.EVERY_30M
            }
        ]
    },
    cli: {
        runLocation: "us-east-1",
        retries: 0
    }
});
