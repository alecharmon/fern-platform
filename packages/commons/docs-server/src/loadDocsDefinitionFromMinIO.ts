import "server-only";

import { cache } from "react";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { FdrAPI } from "@fern-api/fdr-sdk";

const V1_FDR_KEY = "v1/fdr.json";

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

            const response = await minIOClient.send(command);
            if (!response.Body) {
                throw new Error("Empty response body from MinIO");
            }

            const bodyContents = await response.Body.transformToString();
            const json = JSON.parse(bodyContents);
            return json as FdrAPI.docs.v2.read.LoadDocsForUrlResponse;
        } catch (error) {
            console.error("Failed to load docs definition from MinIO:", error);
            return undefined;
        }
    }
);
