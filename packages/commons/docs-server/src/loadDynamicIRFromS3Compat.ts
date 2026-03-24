import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { APIV1Write, FdrAPI } from "@fern-api/fdr-sdk";
import { getS3KeyForDynamicIr } from "@fern-api/fdr-sdk/docs";
import { logger } from "@fern-api/ui-core-utils/logger";
import { cache } from "react";

import type { DynamicIRsByLanguage } from "./loadDynamicIRFromS3";

export const loadDynamicIRFromS3Compat = cache(
    async (
        orgName: string,
        apiName: string,
        snippetsConfig: APIV1Write.SnippetsConfig,
        s3Endpoint: string
    ): Promise<DynamicIRsByLanguage | undefined> => {
        const bucketName =
            process.env.NEXT_PUBLIC_DYNAMIC_IR_BUCKET_NAME ??
            process.env.S3_BUCKET_NAME ??
            process.env.NEXT_PUBLIC_DOCS_DOMAIN;

        if (!bucketName) {
            logger.error("[loadDynamicIR] Missing S3 bucket name for dynamic IR loading");
            return undefined;
        }

        // Credentials are read automatically from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY,
        // which run.sh sets to the SeaweedFS defaults before starting Next.js.
        const s3Client = new S3Client({
            endpoint: s3Endpoint,
            forcePathStyle: true,
            region: "us-east-1" // required by S3 SDK but unused by SeaweedFS
        });

        const dynamicIRsByLanguage: DynamicIRsByLanguage = {};

        try {
            for (const [sdkLanguage, packageName] of Object.entries(snippetsConfig)) {
                const language = sdkLanguage.replace("Sdk", "");

                if (!packageName) {
                    continue;
                }

                const s3Key = getS3KeyForDynamicIr({ orgName, apiName, language });

                try {
                    const response = await s3Client.send(new GetObjectCommand({ Bucket: bucketName, Key: s3Key }));

                    if (!response.Body) {
                        logger.debug(`Empty response body from S3-compatible storage for ${s3Key}`);
                        continue;
                    }

                    const bodyContents = await response.Body.transformToString();
                    dynamicIRsByLanguage[language] = JSON.parse(bodyContents) as FdrAPI.api.v1.register.DynamicIr;
                    logger.debug(`Successfully loaded dynamic IR from S3-compatible storage for ${s3Key}`);
                } catch (error) {
                    logger.debug(`Failed to load dynamic IR for ${s3Key} from S3-compatible storage:`, error);
                }
            }

            return Object.keys(dynamicIRsByLanguage).length > 0 ? dynamicIRsByLanguage : undefined;
        } catch (error) {
            logger.error("[loadDynamicIR] Error loading dynamic IR from S3-compatible storage:", error);
            return undefined;
        }
    }
);
