import * as Sentry from "@sentry/nextjs";

/**
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */
type SentryBaseConfig = Parameters<typeof Sentry.init>[0];

export const baseConfig: SentryBaseConfig = {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    sendDefaultPii: true,
    tracesSampler: (samplingContext) => {
        const name = samplingContext.transactionContext?.name?.toLowerCase() ?? "";

        if (name.includes("middleware")) {
            return 0.0; // drop middleware traces
        }

        if (name.includes("_next/")) {
            return 0.0; // drop middleware traces
        }

        // Use env or default sampling rate for everything else
        return parseFloat(process.env.DASHBOARD_SENTRY_TRACES_SAMPLE_RATE ?? "0.1");
    },
    enableLogs: true,
    serverName: process.env.HOSTNAME || "unknown",
    integrations: [Sentry.consoleLoggingIntegration({ levels: ["debug", "log", "warn", "error"] })]
};
