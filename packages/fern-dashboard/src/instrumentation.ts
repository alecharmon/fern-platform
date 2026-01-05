import { TraceIdRatioBasedSampler } from "@opentelemetry/sdk-trace-base";
import { registerOTel } from "@vercel/otel";
import { isProduction } from "./utils/environment";

export async function register() {
    if (!isProduction()) {
        return;
    }

    registerOTel({
        serviceName: "fern-dashboard",
        traceSampler: new TraceIdRatioBasedSampler(0.1)
    });

    if (process.env.NEXT_RUNTIME === "nodejs") {
        await import("../sentry.server.config");
    }

    if (process.env.NEXT_RUNTIME === "edge") {
        await import("../sentry.edge.config");
    }
}

export const onRequestError = (...args: any[]) => {
    if (!isProduction()) {
        return;
    }

    void import("@sentry/nextjs").then((module) =>
        module.captureRequestError(...(args as Parameters<typeof module.captureRequestError>))
    );
};
