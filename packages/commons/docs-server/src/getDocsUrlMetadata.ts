import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Agent, setGlobalDispatcher } from "undici";

import { withoutStaging } from "@fern-api/docs-utils";
import { FdrLambdaClient } from "@fern-api/fdr-lambda-sdk";

import { cacheSeed } from "./cache-seed";
import { fernToken_admin, getFdrLambdaOrigin } from "./env-variables";
import { isLocal } from "./isLocal";
import { isSelfHosted } from "./isSelfHosted";

setGlobalDispatcher(
    new Agent({
        connect: { timeout: 2147483647 },
        bodyTimeout: 0,
        headersTimeout: 2147483647
    })
);

export const uncachedGetDocsUrlMetadata = async (
    domain: string
): Promise<{
    url: string;
    org: string;
    isPreview: boolean;
}> => {
    if (isLocal()) {
        return {
            url: domain,
            org: domain.split(".")[0] ?? domain,
            isPreview: true
        };
    }

    try {
        // address FDR error: Failed to parse URL: %5Bdomain%5D
        // todo: figure out where these calls originate
        if (domain.includes("[") || domain.includes("%5B")) {
            console.error(`Cannot get docs url metadata for an invalid domain: ${domain}`);
            notFound();
        }

        const client = new FdrLambdaClient({
            environment: getFdrLambdaOrigin(),
            token: isSelfHosted() ? "" : fernToken_admin()
        });

        const response = await client.docs.v2.read.getDocsUrlMetadata({
            url: withoutStaging(domain)
        });

        return {
            url: response.url,
            org: response.org,
            isPreview: response.isPreviewUrl
        };
    } catch (error) {
        console.error(`Failed to get docs url metadata for ${withoutStaging(domain)}`, {
            cause: error
        });
        notFound();
    }
};

export const getDocsUrlMetadata = cache((domain: string) => {
    const get = unstable_cache(() => uncachedGetDocsUrlMetadata(domain), [domain, cacheSeed()], {
        tags: [domain, "getDocsUrlMetadata"]
    });
    return get();
});
