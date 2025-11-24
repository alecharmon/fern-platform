import "server-only";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { FdrAPI } from "@fern-api/fdr-sdk";
import type { Attributes } from "@opentelemetry/api";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { cache } from "react";

const V1_FDR_KEY = "v1/fdr.json";
const tracer = trace.getTracer("fern-docs");

// this function cannot be cached because the response can be > 2MB
export const loadDocsDefinitionFromMinIO = cache(
    async ({
        domain,
        docsBucketName
    }: {
        domain: string;
        docsBucketName: string;
    }): Promise<FdrAPI.docs.v2.read.LoadDocsForUrlResponse | undefined> => {
        try {
            return await runWithSpan(
                "docs.loadDefinition",
                async () => {
                    const accessKeyId = process.env.NEXT_PUBLIC_MINIO_ACCESS_KEY;
                    const secretAccessKey = process.env.NEXT_PUBLIC_MINIO_SECRET_KEY;

                    if (!accessKeyId || !secretAccessKey) {
                        throw new Error("Missing MinIO credentials");
                    }

                    const minIOClient = new S3Client({
                        endpoint: domain,
                        credentials: {
                            accessKeyId,
                            secretAccessKey
                        },
                        forcePathStyle: true,
                        region: "us-east-1" // MinIO dummy region
                    });

                    const command = new GetObjectCommand({
                        Bucket: docsBucketName,
                        Key: V1_FDR_KEY
                    });

                    const response = await runWithSpan("docs.minio.getObject", () => minIOClient.send(command), {
                        "fern.docs.bucket": docsBucketName
                    });

                    if (!response.Body) {
                        throw new Error("Empty response body from MinIO");
                    }

                    const bodyContents = await runWithSpan("docs.minio.readBody", () =>
                        response.Body
                            ? response.Body.transformToString()
                            : Promise.reject(new Error("Empty response body from MinIO"))
                    );
                    const json = await runWithSpan("docs.minio.parseJson", async () => JSON.parse(bodyContents));
                    return json as FdrAPI.docs.v2.read.LoadDocsForUrlResponse;
                },
                {
                    "fern.docs.domain": domain,
                    "fern.docs.bucket": docsBucketName
                }
            );
        } catch (error) {
            console.error("Failed to load docs definition from MinIO:", error);
            return undefined;
        }
    }
);

async function runWithSpan<T>(name: string, fn: () => Promise<T>, attributes?: Attributes): Promise<T> {
    return tracer.startActiveSpan(name, async (span) => {
        if (attributes) {
            span.setAttributes(attributes);
        }
        try {
            const result = await fn();
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
