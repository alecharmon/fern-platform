import * as Sentry from "@sentry/nextjs";
import { OTLPHttpProtoTraceExporter, registerOTel } from "@vercel/otel";
import { baseConfig } from "../sentry.base.config";

const SERVICE_NAME = "fern-docs";

function initOtelExporter() {
    const url = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    if (!url) {
        return undefined;
    }
    return new OTLPHttpProtoTraceExporter({ url });
}

export function register() {
    // Initialize OpenTelemetry
    const traceExporter = initOtelExporter();

    registerOTel({
        serviceName: SERVICE_NAME,
        traceExporter: traceExporter ?? "auto"
    });

    // Initialize Sentry (if DSN is configured)
    if (process.env.SENTRY_DSN) {
        Sentry.init({
            dsn: process.env.SENTRY_DSN,
            ...baseConfig
        });
    }
}
