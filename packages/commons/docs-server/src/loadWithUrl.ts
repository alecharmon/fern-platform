import { isPreviewDomain, withoutStaging } from "@fern-api/docs-utils";
import { FdrLambda, FdrLambdaClient } from "@fern-api/fdr-lambda-sdk";
import { type APIResponse, FdrAPI } from "@fern-api/fdr-sdk/client/types";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Agent, setGlobalDispatcher } from "undici";

import { fernToken_admin, getFdrLambdaOrigin } from "./env-variables";
import { isLocal } from "./isLocal";
import { isSelfHosted } from "./isSelfHosted";
import { loadDocsDefinitionFromMinIO } from "./loadDocsDefinitionFromMinIO";
import { loadDocsDefinitionFromS3 } from "./loadDocsDefinitionFromS3";
import { provideRegistryService } from "./registry";

export type LoadWithUrlResponse = APIResponse<
    FdrAPI.docs.v2.read.LoadDocsForUrlResponse,
    FdrAPI.docs.v2.read.getDocsForUrl.Error
>;

setGlobalDispatcher(
    new Agent({
        connect: { timeout: 2147483647 },
        bodyTimeout: 0,
        headersTimeout: 2147483647
    })
);

/**
 * Helper function to load docs from a raw S3 URL
 */
async function loadDocsFromS3Url(s3Url: string): Promise<FdrAPI.docs.v2.read.LoadDocsForUrlResponse> {
    console.debug(`[loadDocsFromS3Url] Fetching docs from S3: ${s3Url}`);

    const response = await fetch(s3Url);

    if (!response.ok) {
        throw new Error(`Failed to load docs from S3 URL. Status: ${response.status}. Error: ${await response.text()}`);
    }

    const json = await response.json();
    console.debug(`[loadDocsFromS3Url] Successfully loaded docs from S3`);
    return json as FdrAPI.docs.v2.read.LoadDocsForUrlResponse;
}

/**
 * Ensures docs are stored in S3 by calling the FDR Lambda endpoint,
 * then loads the docs from the returned S3 URL
 */
async function ensureDocsInS3AndLoad(domain: string): Promise<FdrAPI.docs.v2.read.LoadDocsForUrlResponse> {
    console.debug(`[ensureDocsInS3AndLoad] Ensuring docs in S3 for domain: ${domain}`);

    if (isLocal() || isSelfHosted()) {
        throw new Error("ensureDocsInS3 is not supported in local or self-hosted environments");
    }

    const client = new FdrLambdaClient({
        environment: getFdrLambdaOrigin(),
        token: fernToken_admin()
    });

    const response = await client.docs.v2.read.ensureDocsInS3({
        url: FdrLambda.Url(domain)
    });

    if (!response.ok) {
        console.error(`[ensureDocsInS3AndLoad] Failed to ensure docs in S3 for ${domain}`, {
            error: response.error
        });
        throw new Error(`Failed to ensure docs in S3: ${JSON.stringify(response.error)}`);
    }

    console.debug(`[ensureDocsInS3AndLoad] Got S3 URL: ${response.body.s3Url}`);

    return loadDocsFromS3Url(response.body.s3Url);
}

export const loadWithUrl = cache(async (domain: string): Promise<FdrAPI.docs.v2.read.LoadDocsForUrlResponse> => {
    return unstable_cache(
        async () => {
            return uncachedLoadWithUrl(domain);
        },
        [domain],
        { tags: ["loadWithUrl", domain] }
    )();
});

/**
 * - If the token is a WorkOS token, we need to use the getPrivateDocsForUrl endpoint.
 * - Otherwise, we can use the getDocsForUrl endpoint (including custom auth).
 *
 * Note: this function cannot be stored in the data cache because the response can be > 2MB,
 */
export const uncachedLoadWithUrl = async (domain: string): Promise<FdrAPI.docs.v2.read.LoadDocsForUrlResponse> => {
    const domainWithoutStaging = withoutStaging(domain);

    // address FDR error: Failed to parse URL: %5Bdomain%5D
    // todo: figure out where these calls originate
    if (domain.includes("[") || domain.includes("%5B")) {
        console.error(`Cannot load docs from an invalid domain: ${domain}`);
        notFound();
    }

    if (isLocal()) {
        const response = await provideRegistryService().docs.v2.read.getDocsForUrl({
            url: FdrAPI.Url("/")
        });
        if (response.ok) {
            return response.body;
        }
        console.error("Failed to load docs", {
            cause: response.error
        });
        notFound();
    }

    if (isSelfHosted()) {
        const docsUrl = process.env.NEXT_PUBLIC_DOCS_DOMAIN ?? "";
        const docsBucketName = domain.replace(/^https?:\/\//, "");

        if (!docsUrl) {
            notFound();
        }

        const response = await loadDocsDefinitionFromMinIO({
            domain: process.env.NEXT_PUBLIC_MINIO_BUCKET_HOST ?? "http://localhost:9000",
            docsBucketName
        });

        if (response != null) {
            return response;
        }

        notFound();
    }

    try {
        const response = await loadDocsDefinitionFromS3(domainWithoutStaging, getDocsDefinitionBucketName());
        if (response != null) {
            return response;
        }
    } catch (error) {
        console.error("Failed to load docs definition:", error);
    }

    if (isPreviewDomain(domain)) {
        console.error("Failing to load preview link: ", domain);
        notFound();
    }

    // Use ensureDocsInS3 to load docs from S3 instead of calling getDocsForUrl
    try {
        const response = await ensureDocsInS3AndLoad(domainWithoutStaging);
        return response;
    } catch (error) {
        console.error("Failed to ensure docs in S3", {
            cause: error
        });
        notFound();
    }
};

function getDocsDefinitionBucketName() {
    return process.env.DOCS_DEFINITION_S3_BUCKET_NAME ?? "fdr-dev2-docs-definitions-public";
}
