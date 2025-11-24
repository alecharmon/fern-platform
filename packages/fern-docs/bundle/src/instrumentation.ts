import * as Sentry from "@sentry/nextjs";
import { SentrySpanProcessor } from "@sentry/opentelemetry";
import { OTLPHttpProtoTraceExporter, registerOTel } from "@vercel/otel";

const SERVICE_NAME = "fern-docs";
const DEFAULT_JAEGER_URL = "http://localhost:4318/v1/traces";
let hasInitializedSentry = false;

function getEnvironment() {
    return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
}

function parseRate(value: string | undefined, fallback: number) {
    if (value == null) {
        return fallback;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
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
            tracesSampleRate: parseRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 1),
            profilesSampleRate: parseRate(process.env.SENTRY_PROFILES_SAMPLE_RATE, 0)
        });
        hasInitializedSentry = true;
    }

    return new SentrySpanProcessor();
}

function initJaegerExporter() {
    const url = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? DEFAULT_JAEGER_URL;
    return new OTLPHttpProtoTraceExporter({ url });
}

export function register() {
    const isDev = process.env.NODE_ENV === "development";

    const environment = getEnvironment();
    const isLocalTracingEnabled = process.env.LOCAL_TRACING === "true";

    const traceExporter = isLocalTracingEnabled ? initJaegerExporter() : undefined;
    const sentrySpanProcessor =
        !isLocalTracingEnabled && process.env.NEXT_PUBLIC_SENTRY_DOCS_DSN && !isDev
            ? initSentrySpanProcessor(environment)
            : undefined;

    registerOTel({
        serviceName: SERVICE_NAME,
        traceExporter: traceExporter ?? "auto",
        ...(sentrySpanProcessor && { spanProcessors: [sentrySpanProcessor] })
    });
}

export const onRequestError = Sentry.captureRequestError;
