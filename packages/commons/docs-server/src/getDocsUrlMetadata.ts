import { withoutStaging } from "@fern-api/docs-utils";
import { FdrLambda, FdrLambdaClient } from "@fern-api/fdr-lambda-sdk";
import { logger } from "@fern-api/ui-core-utils/logger";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Agent, setGlobalDispatcher } from "undici";

import { getDocsServiceJWT } from "./auth/serviceJWT";
import { getFdrLambdaOrigin } from "./env-variables";
import { isLocal } from "./isLocal";
import { isSelfHosted } from "./isSelfHosted";

if (!isSelfHosted()) {
    setGlobalDispatcher(
        new Agent({
            connect: { timeout: 300_000 },
            bodyTimeout: 600_000,
            headersTimeout: 600_000
        })
    );
}

export const uncachedGetDocsUrlMetadata = async (
    domain: string
): Promise<{
    url: string;
    org: string;
    isPreview: boolean;
    enableAlgoliaOnPreview: boolean;
}> => {
    if (isLocal()) {
        return {
            url: domain,
            org: domain.split(".")[0] ?? domain,
            isPreview: true,
            enableAlgoliaOnPreview: false
        };
    }

    if (isSelfHosted()) {
        const org = process.env.NEXT_PUBLIC_DOCS_DOMAIN?.split(".")[0] ?? domain.split(".")[0] ?? domain;
        return {
            url: domain,
            org,
            isPreview: false,
            enableAlgoliaOnPreview: false
        };
    }

    try {
        // address FDR error: Failed to parse URL: %5Bdomain%5D
        // todo: figure out where these calls originate
        if (domain.includes("[") || domain.includes("%5B")) {
            logger.error(`Cannot get docs url metadata for an invalid domain: ${domain}`);
            notFound();
        }

        const token = await getDocsServiceJWT();
        const client = new FdrLambdaClient({
            environment: getFdrLambdaOrigin(),
            token
        });

        const response = await client.docs.v2.read.getDocsUrlMetadata({
            url: FdrLambda.Url(withoutStaging(domain))
        });

        if (!response.ok) {
            logger.error(`Failed to get docs url metadata for ${withoutStaging(domain)}`, {
                error: response.error
            });
            notFound();
        }

        return {
            url: response.body.url,
            org: response.body.org,
            isPreview: response.body.isPreviewUrl,
            enableAlgoliaOnPreview: response.body.enableAlgoliaOnPreview
        };
    } catch (error) {
        logger.error(`Failed to get docs url metadata for ${withoutStaging(domain)}`, {
            cause: error
        });
        notFound();
    }
};

export const getDocsUrlMetadata = cache((domain: string) => {
    const get = unstable_cache(() => uncachedGetDocsUrlMetadata(domain), [domain], {
        tags: [domain, "getDocsUrlMetadata"]
    });
    return get();
});
