import * as Sentry from "@sentry/nextjs";

/**
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */
type SentryBaseConfig = Parameters<typeof Sentry.init>[0];

export const baseConfig: SentryBaseConfig = {
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    sendDefaultPii: true,
    tracesSampleRate: 0,
    skipOpenTelemetrySetup: true,
    enableLogs: true,
    serverName: process.env.HOSTNAME || "unknown",
    integrations: [Sentry.consoleLoggingIntegration({ levels: ["debug", "log", "warn", "error"] })]
};
