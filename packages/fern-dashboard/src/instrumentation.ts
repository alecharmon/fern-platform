import { TraceIdRatioBasedSampler } from "@opentelemetry/sdk-trace-base";
import { registerOTel } from "@vercel/otel";
import { isProduction } from "./utils/environment";
export async function register() {
    let traceSampler: TraceIdRatioBasedSampler = new TraceIdRatioBasedSampler(1.0);
    // In production, sample 10% of traces
    if (isProduction()) {
        // Sentry setup (production only)
        if (process.env.NEXT_RUNTIME === "nodejs") {
            await import("../sentry.server.config");
        }

        if (process.env.NEXT_RUNTIME === "edge") {
            await import("../sentry.edge.config");
        }
        // Set trace sampler to 10% in production
        traceSampler = new TraceIdRatioBasedSampler(0.1);
    }

    registerOTel({
        serviceName: "fern-dashboard",
        traceExporter: "auto",
        traceSampler
    });
}

export const onRequestError = (...args: any[]) => {
    if (!isProduction()) {
        return;
    }

    void import("@sentry/nextjs").then((module) =>
        module.captureRequestError(...(args as Parameters<typeof module.captureRequestError>))
    );
};
