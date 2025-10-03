import { unstable_cache } from "next/cache";
import { cache } from "react";

import { createHash } from "crypto";

import { APIV1Write } from "@fern-api/fdr-sdk";

import { isLocal } from "./isLocal";
import { isSelfHosted } from "./isSelfHosted";
import { DynamicIRsByLanguage, loadDynamicIRFromS3 } from "./loadDynamicIRFromS3";

export type DynamicIRsByAPI = Record<string, DynamicIRsByLanguage>;

function hashSnippetsConfig(snippetsConfig: APIV1Write.SnippetsConfig | undefined): string {
    if (!snippetsConfig) {
        return "no-config";
    }
    return createHash("sha256").update(JSON.stringify(snippetsConfig)).digest("hex").slice(0, 16);
}

export const loadDynamicIRWithUrl = cache(
    async ({
        orgId,
        apiName,
        snippetsConfig
    }: {
        orgId: string;
        apiName: string;
        snippetsConfig: APIV1Write.SnippetsConfig | undefined;
    }): Promise<DynamicIRsByLanguage | undefined> => {
        return unstable_cache(
            async () => {
                // todo: support dynamic snippets in local dev
                if (isLocal()) {
                    return undefined;
                }

                // todo: support dynamic snippets in self-hosted
                if (isSelfHosted()) {
                    return undefined;
                }

                if (!snippetsConfig) {
                    return undefined;
                }

                try {
                    const response = await loadDynamicIRFromS3(
                        orgId,
                        apiName,
                        snippetsConfig,
                        getDynamicIRBucketName()
                    );
                    if (response != null && Object.keys(response).length > 0) {
                        return response;
                    }
                } catch (error) {
                    console.error("Failed to load dynamic IR:", error);
                }

                return undefined;
            },
            [orgId, apiName, hashSnippetsConfig(snippetsConfig)],
            {
                tags: [
                    "loadDynamicIRWithUrl",
                    `org:${orgId}`,
                    `api:${apiName}`,
                    `config:${hashSnippetsConfig(snippetsConfig)}`
                ]
            }
        )();
    }
);

function getDynamicIRBucketName() {
    return process.env.DYNAMIC_IR_S3_BUCKET_NAME ?? "fdr-prod-api-definition-source-files";
}
