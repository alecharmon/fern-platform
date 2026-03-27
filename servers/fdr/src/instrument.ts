import * as Sentry from "@sentry/node";

const SENTRY_DSN = process.env.FDR_SENTRY_DSN;

if (SENTRY_DSN) {
    Sentry.init({
        dsn: SENTRY_DSN,
        environment: process.env.APPLICATION_ENVIRONMENT || "dev",
        sendDefaultPii: true,
        tracesSampleRate: 0.5
    });
}
