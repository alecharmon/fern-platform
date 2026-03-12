import { withoutStaging } from "@fern-api/docs-utils";
import { FdrLambda, FdrLambdaClient } from "@fern-api/fdr-lambda-sdk";
import { logger } from "@fern-api/ui-core-utils/logger";
import { unstable_cache } from "next/cache";
import { cache } from "react";

import { getDocsServiceJWT } from "./auth/serviceJWT";
import { getFdrLambdaOrigin } from "./env-variables";
import { isDocsDev } from "./isDocsDev";
import { isLocal } from "./isLocal";
import { isSelfHosted } from "./isSelfHosted";

export type DocsDefinitionField = FdrLambda.docs.v2.read.DocsDefinitionField;
export type GetDocsFieldsResponse = FdrLambda.docs.v2.read.GetDocsFieldsResponse;
export const DocsDefinitionField = FdrLambda.docs.v2.read.DocsDefinitionField;

const getDocsFieldsDevCache = new Map<string, GetDocsFieldsResponse>();
const pendingGetDocsFieldsRequests = new Map<string, Promise<GetDocsFieldsResponse | null>>();

function createCacheKey(domain: string, fields: DocsDefinitionField[]): string {
    return `${domain}:${fields.sort().join(",")}`;
}

/**
 * Loads specific fields from the docs definition stored in FDR.
 * This is more efficient than loading the entire docs definition when you only need specific parts.
 *
 * @param domain - The domain to load fields from
 * @param fields - Array of field enums to load (e.g., ["BASE_URL", "FILES_V2", "CONFIG"])
 * @returns The requested fields, or null if not found
 */
export const getDocsFields = async (
    domain: string,
    fields: DocsDefinitionField[]
): Promise<GetDocsFieldsResponse | null> => {
    if (isLocal() || isSelfHosted()) {
        return null;
    }

    const cacheKey = createCacheKey(domain, fields);

    if (isDocsDev()) {
        const cached = getDocsFieldsDevCache.get(cacheKey);
        if (cached) {
            logger.debug(`[GetDocsFields] Cache hit for ${cacheKey}`);
            return cached;
        }

        const pending = pendingGetDocsFieldsRequests.get(cacheKey);
        if (pending) {
            logger.debug(`[GetDocsFields] Waiting for in-flight request for ${cacheKey}`);
            return pending;
        }

        logger.debug(`[GetDocsFields] Cache miss for ${cacheKey}`);
        const requestPromise = (async () => {
            try {
                const response = await uncachedGetDocsFields(domain, fields);
                if (response) {
                    getDocsFieldsDevCache.set(cacheKey, response);
                }
                pendingGetDocsFieldsRequests.delete(cacheKey);
                return response;
            } catch (error) {
                pendingGetDocsFieldsRequests.delete(cacheKey);
                logger.error(`[GetDocsFields] Error getting fields ${cacheKey}:`, error);
                throw error;
            }
        })();

        pendingGetDocsFieldsRequests.set(cacheKey, requestPromise);
        return requestPromise;
    }

    return cachedGetDocsFields(domain, fields);
};

const cachedGetDocsFields = cache(
    async (domain: string, fields: DocsDefinitionField[]): Promise<GetDocsFieldsResponse | null> => {
        return unstable_cache(
            async () => {
                return uncachedGetDocsFields(domain, fields);
            },
            [domain, ...fields.sort()],
            { tags: ["getDocsFields", domain, ...fields] }
        )();
    }
);

export const uncachedGetDocsFields = async (
    domain: string,
    fields: DocsDefinitionField[]
): Promise<GetDocsFieldsResponse | null> => {
    const domainWithoutStaging = withoutStaging(domain);

    try {
        // Use service JWT for authentication instead of fern admin token
        const token = isSelfHosted() ? "" : await getDocsServiceJWT();
        const client = new FdrLambdaClient({
            environment: getFdrLambdaOrigin(),
            token
        });

        const response = await client.docs.v2.read.getDocsFields({
            domain: domainWithoutStaging,
            fields
        });

        if (!response.ok) {
            logger.error(`Failed to get docs fields for ${domainWithoutStaging}:${fields.join(",")}`, {
                error: response.error
            });
            return null;
        }

        return response.body;
    } catch (error) {
        logger.error(`Failed to get docs fields for ${domainWithoutStaging}:${fields.join(",")}`, {
            cause: error
        });
        return null;
    }
};
