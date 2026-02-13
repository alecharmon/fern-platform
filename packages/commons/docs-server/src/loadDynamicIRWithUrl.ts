import type { APIV1Write } from "@fern-api/fdr-sdk";
import { cache } from "react";

import { isLocal } from "./isLocal";
import { isSelfHosted } from "./isSelfHosted";
import { loadDynamicIRFromMinIO } from "./loadDynamicIRFromMinIO";
import { type DynamicIRsByLanguage, loadDynamicIRFromS3 } from "./loadDynamicIRFromS3";

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
                const minioEndpoint = process.env.NEXT_PUBLIC_MINIO_BUCKET_HOST ?? "http://localhost:9000";
                const response = await loadDynamicIRFromMinIO(orgId, apiName, snippetsConfig, minioEndpoint);
                if (response != null && Object.keys(response).length > 0) {
                    return response;
                }
            } catch (error) {
                console.error("Failed to load dynamic IR from MinIO:", error);
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
            console.error("Failed to load dynamic IR:", error);
        }

        return undefined;
    }
);

function getDynamicIRBucketName() {
    return process.env.DYNAMIC_IR_S3_BUCKET_NAME ?? "fdr-prod-api-definition-source-files";
}
