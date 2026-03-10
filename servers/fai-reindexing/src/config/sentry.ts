import * as Sentry from "@sentry/node";

const SENTRY_DSN = process.env.FAI_SENTRY_DSN;

export function initSentry(serviceName: string): void {
    if (!SENTRY_DSN) {
        return;
    }

    Sentry.init({
        dsn: SENTRY_DSN,
        environment: process.env.ENVIRONMENT || "dev",
        serverName: serviceName,
        tracesSampleRate: 1.0,
        integrations: [Sentry.consoleIntegration()]
    });
}
