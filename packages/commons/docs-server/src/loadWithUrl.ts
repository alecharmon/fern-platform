import { isPreviewDomain, withoutStaging } from "@fern-api/docs-utils";
import { type APIResponse, FdrAPI } from "@fern-api/fdr-sdk/client/types";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Agent, setGlobalDispatcher } from "undici";

import { isDocsDev } from "./isDocsDev";
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

// In-memory cache for docs dev mode to avoid Next.js 2MB cache limit
// Stores both the response and the timestamp for time-based invalidation
interface CacheEntry {
    response: FdrAPI.docs.v2.read.LoadDocsForUrlResponse;
    timestamp: number;
}
const docsDevCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<FdrAPI.docs.v2.read.LoadDocsForUrlResponse>>();

// Cache TTL for local development (2 seconds) to allow hot reload while maintaining some caching
const LOCAL_CACHE_TTL_MS = 2000;

export const loadWithUrl = async (domain: string): Promise<FdrAPI.docs.v2.read.LoadDocsForUrlResponse> => {
    // In docs dev mode (including local CLI), use in-memory cache with time-based invalidation
    if (isDocsDev()) {
        const now = Date.now();
        const cached = docsDevCache.get(domain);

        // For local CLI development, use shorter TTL for hot reload
        const ttl = isLocal() ? LOCAL_CACHE_TTL_MS : Infinity;

        // Check if we have a valid cached response (not expired)
        if (cached && now - cached.timestamp < ttl) {
            console.debug(`[DocsDevCache] Cache hit for domain: ${domain} (age: ${now - cached.timestamp}ms)`);
            return cached.response;
        }

        // If cache is stale, delete it
        if (cached) {
            console.debug(
                `[DocsDevCache] Cache expired for domain: ${domain} (age: ${now - cached.timestamp}ms, ttl: ${ttl}ms)`
            );
            docsDevCache.delete(domain);
        }

        // Check if there's already a pending request for this domain
        const pending = pendingRequests.get(domain);
        if (pending) {
            console.debug(`[DocsDevCache] Waiting for in-flight request for domain: ${domain}`);
            return pending;
        }

        // Start a new request and track it
        console.debug(`[DocsDevCache] Cache miss for domain: ${domain}`);
        const requestPromise = (async () => {
            try {
                const response = await uncachedLoadWithUrl(domain);
                // Once resolved, store in cache with timestamp and remove from pending
                docsDevCache.set(domain, { response, timestamp: Date.now() });
                pendingRequests.delete(domain);
                console.debug(`[DocsDevCache] Cached and cleaned up pending request for domain: ${domain}`);
                return response;
            } catch (error) {
                // On error, remove from pending and re-throw
                pendingRequests.delete(domain);
                console.error(`[DocsDevCache] Error loading domain ${domain}, cleaned up pending request:`, error);
                throw error;
            }
        })();

        pendingRequests.set(domain, requestPromise);
        return requestPromise;
    }

    // For non-dev environments, use React cache and unstable_cache
    return cachedLoadWithUrl(domain);
};

const cachedLoadWithUrl = cache(async (domain: string): Promise<FdrAPI.docs.v2.read.LoadDocsForUrlResponse> => {
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
            domain:
                process.env.MINIO_BUCKET_HOST ?? process.env.NEXT_PUBLIC_MINIO_BUCKET_HOST ?? "http://localhost:9000",
            docsBucketName
        });

        if (response != null) {
            return response;
        }

        notFound();
    }

    const decodedDomain = decodeURIComponent(domain);
    const decodedDomainWithoutStaging = withoutStaging(decodedDomain);
    console.log("[loadWithUrl] loading from S3:", {
        domain: decodedDomain,
        domainWithoutStaging: decodedDomainWithoutStaging
    });
    try {
        const response = await loadDocsDefinitionFromS3(decodedDomainWithoutStaging, getDocsDefinitionBucketName());
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

    notFound();
};

function getDocsDefinitionBucketName() {
    return process.env.DOCS_DEFINITION_S3_BUCKET_NAME ?? "fdr-dev2-docs-definitions-public";
}
