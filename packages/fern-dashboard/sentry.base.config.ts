import * as Sentry from "@sentry/nextjs";

/**
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */
type SentryBaseConfig = Parameters<typeof Sentry.init>[0];

export const baseConfig: SentryBaseConfig = {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    sendDefaultPii: true,
    tracesSampleRate: 1,
    tracesSampler: (samplingContext) => {
        const name = samplingContext.transactionContext?.name?.toLowerCase() ?? "";

        // Heavily sample middleware routes
        if (name.includes("middleware")) {
            return 0.01; // sample 1% of middleware traces
        }

        // drastically drop _next/static or other noise
        if (name.includes("_next/")) {
            return 0.001;
        }

        // Use env or default sampling rate for everything else
        return parseFloat(process.env.DASHBOARD_SENTRY_TRACES_SAMPLE_RATE ?? "0.1");
    },
    enableLogs: true,
    serverName: process.env.HOSTNAME || "unknown",
    integrations: [Sentry.consoleLoggingIntegration({ levels: ["debug", "log", "warn", "error"] })]
};
