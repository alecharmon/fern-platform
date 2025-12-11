import * as Sentry from "@sentry/nextjs";
import { SentrySpanProcessor } from "@sentry/opentelemetry";
import { OTLPHttpProtoTraceExporter, registerOTel } from "@vercel/otel";

const SERVICE_NAME = "fern-docs";
let hasInitializedSentry = false;

function getEnvironment() {
    return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
}

function initSentrySpanProcessor(environment: string) {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DOCS_DSN;
    if (!dsn) {
        return undefined;
    }

    if (!hasInitializedSentry) {
        Sentry.init({
            dsn,
            environment,
            tracesSampleRate: 0,
            profilesSampleRate: 0,
            skipOpenTelemetrySetup: true
        });
        hasInitializedSentry = true;
    }

    return new SentrySpanProcessor();
}

function initOtelExporter() {
    const url = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    if (!url) {
        return undefined;
    }
    return new OTLPHttpProtoTraceExporter({ url });
}

export function register() {
    const isDev = process.env.NODE_ENV === "development";

    const environment = getEnvironment();

    const traceExporter = initOtelExporter();
    const sentrySpanProcessor =
        process.env.NEXT_PUBLIC_SENTRY_DOCS_DSN && !isDev ? initSentrySpanProcessor(environment) : undefined;

    registerOTel({
        serviceName: SERVICE_NAME,
        traceExporter: traceExporter ?? "auto",
        ...(sentrySpanProcessor && { spanProcessors: [sentrySpanProcessor] })
    });
}

export const onRequestError = Sentry.captureRequestError;
