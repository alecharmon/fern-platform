import * as Sentry from "@sentry/nextjs";

/**
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */
type SentryBaseConfig = Parameters<typeof Sentry.init>[0];

export const baseConfig: SentryBaseConfig = {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 1,
    enableLogs: true,
    integrations: [Sentry.consoleLoggingIntegration({ levels: ["debug", "log", "warn", "error"] })]
};
