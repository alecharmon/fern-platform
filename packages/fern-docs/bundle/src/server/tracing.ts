import type { Attributes, Span } from "@opentelemetry/api";
import { SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("fern-docs");

export { tracer };

export async function runAsyncSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Attributes
): Promise<T> {
    return tracer.startActiveSpan(name, async (span) => {
        if (attributes) {
            span.setAttributes(attributes);
        }
        try {
            const result = await fn(span);
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
        } catch (error) {
            span.recordException(error as Error);
            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error instanceof Error ? error.message : "Unknown error"
            });
            throw error;
        } finally {
            span.end();
        }
    });
}

export function runSyncSpan<T>(name: string, fn: (span: Span) => T, attributes?: Attributes): T {
    return tracer.startActiveSpan(name, (span) => {
        if (attributes) {
            span.setAttributes(attributes);
        }
        try {
            const result = fn(span);
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
        } catch (error) {
            span.recordException(error as Error);
            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error instanceof Error ? error.message : "Unknown error"
            });
            throw error;
        } finally {
            span.end();
        }
    });
}
