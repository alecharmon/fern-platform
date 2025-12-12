import { OTLPHttpProtoTraceExporter, registerOTel } from "@vercel/otel";

const SERVICE_NAME = "fern-docs";

function initOtelExporter() {
    const url = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    if (!url) {
        return undefined;
    }
    return new OTLPHttpProtoTraceExporter({ url });
}

export function register() {
    const traceExporter = initOtelExporter();

    registerOTel({
        serviceName: SERVICE_NAME,
        traceExporter: traceExporter ?? "auto"
    });
}
