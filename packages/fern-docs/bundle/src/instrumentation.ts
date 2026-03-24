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

/**
 * Sets default production env vars for the local dev server.
 * The local standalone bundle does not receive these from the host environment
 * (unlike self-hosted or Vercel deployments), so we set them here at startup.
 */
function setLocalDevDefaults() {
    if (process.env.NEXT_PUBLIC_IS_LOCAL !== "1") {
        return;
    }

    const defaults: Record<string, string> = {
        NEXT_PUBLIC_FDR_ORIGIN: "https://registry.buildwithfern.com",
        NEXT_PUBLIC_FAI_ORIGIN: "https://fai.buildwithfern.com",
        NEXT_PUBLIC_FDR_LAMBDA_ORIGIN: "https://registry-v2.buildwithfern.com"
    };

    for (const [key, value] of Object.entries(defaults)) {
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

export function register() {
    // Set default env vars for local dev before anything else
    setLocalDevDefaults();

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
