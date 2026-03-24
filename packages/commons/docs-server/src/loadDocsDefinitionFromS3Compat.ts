import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { FdrAPI } from "@fern-api/fdr-sdk";
import { logger } from "@fern-api/ui-core-utils/logger";
import { cache } from "react";

const V1_FDR_KEY = "v1/fdr.json";

// this function cannot be cached because the response can be > 2MB
export const loadDocsDefinitionFromS3Compat = cache(
    async ({
        domain,
        docsBucketName
    }: {
        domain: string;
        docsBucketName: string;
    }): Promise<FdrAPI.docs.v2.read.LoadDocsForUrlResponse | undefined> => {
        try {
            // Credentials are read automatically from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY,
            // which run.sh sets to the SeaweedFS defaults before starting Next.js.
            const s3Client = new S3Client({
                endpoint: domain,
                forcePathStyle: true,
                region: "us-east-1" // required by S3 SDK but unused by SeaweedFS
            });

            const response = await s3Client.send(new GetObjectCommand({ Bucket: docsBucketName, Key: V1_FDR_KEY }));

            if (!response.Body) {
                throw new Error("Empty response body from S3-compatible storage");
            }

            const bodyContents = await response.Body.transformToString();
            return JSON.parse(bodyContents) as FdrAPI.docs.v2.read.LoadDocsForUrlResponse;
        } catch (error) {
            logger.error("[loadDocsFromS3Compat] Failed to load docs definition from S3-compatible storage:", error);
            return undefined;
        }
    }
);
