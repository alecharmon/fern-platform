import type { APIV1Write } from "@fern-api/fdr-sdk";
import { logger } from "@fern-api/ui-core-utils/logger";
import { cache } from "react";

import { isLocal } from "./isLocal";
import { isSelfHosted } from "./isSelfHosted";
import { type DynamicIRsByLanguage, loadDynamicIRFromS3 } from "./loadDynamicIRFromS3";
import { loadDynamicIRFromS3Compat } from "./loadDynamicIRFromS3Compat";

export type DynamicIRsByAPI = Record<string, DynamicIRsByLanguage>;

export const loadDynamicIRWithUrl = cache(
    async ({
        orgId,
        apiName,
        snippetsConfig,
        domain
    }: {
        orgId: string;
        apiName: string;
        snippetsConfig: APIV1Write.SnippetsConfig | undefined;
        domain?: string;
    }): Promise<DynamicIRsByLanguage | undefined> => {
        if (isLocal()) {
            return undefined;
        }

        if (!snippetsConfig) {
            return undefined;
        }

        if (isSelfHosted()) {
            try {
                const s3Endpoint =
                    process.env.S3_ENDPOINT ?? process.env.NEXT_PUBLIC_S3_ENDPOINT ?? "http://localhost:8333";
                const response = await loadDynamicIRFromS3Compat(orgId, apiName, snippetsConfig, s3Endpoint);
                if (response != null && Object.keys(response).length > 0) {
                    return response;
                }
            } catch (error) {
                logger.error("Failed to load dynamic IR from S3-compatible storage:", error);
            }
            return undefined;
        }

        try {
            const response = await loadDynamicIRFromS3(
                orgId,
                apiName,
                snippetsConfig,
                getDynamicIRBucketName(),
                domain
            );
            if (response != null && Object.keys(response).length > 0) {
                return response;
            }
        } catch (error) {
            logger.error("Failed to load dynamic IR:", error);
        }

        return undefined;
    }
);

function getDynamicIRBucketName() {
    return process.env.DYNAMIC_IR_S3_BUCKET_NAME ?? "fdr-prod-api-definition-source-files";
}
