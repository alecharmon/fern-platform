import type { APIV1Write, FdrAPI } from "@fern-api/fdr-sdk";
import { getS3KeyForDynamicIr } from "@fern-api/fdr-sdk/docs";
import { logger } from "@fern-api/ui-core-utils/logger";
import { cache } from "react";

import { getSignedUrl } from "./loadDocsDefinitionFromS3";

export type DynamicIRsByLanguage = Record<string, FdrAPI.api.v1.register.DynamicIr>;

export const loadDynamicIRFromS3 = cache(
    async (
        orgName: string,
        apiName: string,
        snippetsConfig: APIV1Write.SnippetsConfig,
        docsBucketName: string,
        domain?: string
    ): Promise<DynamicIRsByLanguage | undefined> => {
        const dynamicIRsByLanguage: DynamicIRsByLanguage = {};
        try {
            for (const [sdkLanguage, packageName] of Object.entries(snippetsConfig)) {
                const language = sdkLanguage.replace("Sdk", "");

                if (!packageName) {
                    continue;
                }

                logger.debug(`Fetching dynamic IR for ${orgName}:${apiName}:${language}...`);

                const s3Key = getS3KeyForDynamicIr({
                    orgName,
                    apiName,
                    language
                });

                const signedUrl = await getSignedUrl({
                    Bucket: docsBucketName,
                    Key: s3Key,
                    expiresIn: 60 * 60 // 1 hour
                });

                const tags = [orgName, apiName, language, "loadDynamicIRFromS3"];
                if (domain) {
                    tags.push(domain);
                }
                const response = await fetch(signedUrl, {
                    next: { tags }
                });

                if (response.ok) {
                    logger.debug(`Successfully loaded dynamic IR from S3 for ${s3Key}: ${signedUrl}`);
                    const json = await response.json();
                    dynamicIRsByLanguage[language] = json as FdrAPI.api.v1.register.DynamicIr;
                } else {
                    logger.warn(
                        `Failed to load dynamic IR for ${s3Key} from S3. Status: ${response.status}. Error: ${await response.text()}`
                    );
                }
            }

            if (Object.keys(dynamicIRsByLanguage).length > 0) {
                return dynamicIRsByLanguage;
            }

            return undefined;
        } catch (error) {
            logger.warn("Error loading dynamic IR from S3:", error);
            return undefined;
        }
    }
);
