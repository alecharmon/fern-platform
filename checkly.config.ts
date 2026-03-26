import { defineConfig } from "checkly";
import { AlertEscalationBuilder, Frequency, SlackAlertChannel, WebhookAlertChannel } from "checkly/constructs";

// Existing alert channels managed in Checkly UI, referenced by ID
const incidentIoChannel = WebhookAlertChannel.fromId(273151);
const docsNotifSlack = SlackAlertChannel.fromId(273153);

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
                frequency: Frequency.EVERY_6H,
                // Slack + Incident.io on first failure; reminder at 30 min triggers incident creation
                alertChannels: [docsNotifSlack, incidentIoChannel],
                alertEscalationPolicy: AlertEscalationBuilder.runBasedEscalation(1, {
                    interval: 30,
                    amount: 1
                })
            },
            {
                name: "Customer Production Site Checks",
                logicalId: "customer-production-site-checks",
                pwProjects: ["checkly:customer-smoke"],
                installCommand: "pnpm install --frozen-lockfile",
                frequency: Frequency.EVERY_5M,
                locations: ["us-east-1", "eu-west-1"],
                // Slack + Incident.io on first failure; reminder at 30 min triggers incident creation
                alertChannels: [docsNotifSlack, incidentIoChannel],
                alertEscalationPolicy: AlertEscalationBuilder.runBasedEscalation(1, {
                    interval: 30,
                    amount: 1
                })
            },
            {
                name: "Dev Site Sitemap Checks",
                logicalId: "dev-site-sitemap-checks",
                pwProjects: ["checkly:dev-sitemap-smoke"],
                installCommand: "pnpm install --frozen-lockfile",
                frequency: Frequency.EVERY_1H,
                locations: ["us-east-1"],
                alertChannels: [docsNotifSlack, incidentIoChannel],
                alertEscalationPolicy: AlertEscalationBuilder.runBasedEscalation(1, {
                    interval: 30,
                    amount: 1
                })
            },
            {
                name: "Docs RBAC Tests",
                logicalId: "docs-rbac-tests",
                pwProjects: ["checkly:docs-tests"],
                installCommand: "pnpm install --frozen-lockfile",
                frequency: Frequency.EVERY_30M,
                locations: ["us-east-1"],
                alertChannels: [docsNotifSlack, incidentIoChannel],
                alertEscalationPolicy: AlertEscalationBuilder.runBasedEscalation(1, {
                    interval: 30,
                    amount: 1
                })
            }
        ]
    },
    cli: {
        runLocation: "us-east-1",
        retries: 0
    }
});
