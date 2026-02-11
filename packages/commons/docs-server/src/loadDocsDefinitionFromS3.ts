import "server-only";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl as getUncachedSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { FdrAPI } from "@fern-api/fdr-sdk";
import { getS3KeyForV1DocsDefinition } from "@fern-api/fdr-sdk/docs";
import { cache } from "react";

import { isDocsDev } from "./isDocsDev";
import { isLocal } from "./isLocal";
import { isSelfHosted } from "./isSelfHosted";

export const getSignedUrl = async ({ Bucket, Key, expiresIn }: { Bucket: string; Key: string; expiresIn: number }) => {
    if (isLocal() || isSelfHosted()) {
        throw new Error("signed URL is not accessible in local preview mode");
    }

    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
        throw new Error("AWS credentials not found");
    }

    const s3Client = new S3Client({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: {
            accessKeyId,
            secretAccessKey
        }
    });

    const command = new GetObjectCommand({
        Bucket,
        Key
    });

    return await getUncachedSignedUrl(s3Client, command, { expiresIn });
};

// In-memory cache for docs dev mode to avoid Next.js 2MB cache limit
const docsDevCache = new Map<string, FdrAPI.docs.v2.read.LoadDocsForUrlResponse>();
const pendingRequests = new Map<string, Promise<FdrAPI.docs.v2.read.LoadDocsForUrlResponse | undefined>>();

// this function cannot be cached because the response can be > 2MB
export const loadDocsDefinitionFromS3 = async (
    domain: string,
    docsBucketName: string
): Promise<FdrAPI.docs.v2.read.LoadDocsForUrlResponse | undefined> => {
    // In docs dev mode, use in-memory cache instead of React cache
    if (isDocsDev()) {
        const cacheKey = `${domain}:${docsBucketName}`;

        // Check if we have a cached response
        const cached = docsDevCache.get(cacheKey);
        if (cached) {
            console.debug(`[DocsDevCache] Cache hit for S3 docs definition: ${cacheKey}`);
            return cached;
        }

        // Check if there's already a pending request for this key
        const pending = pendingRequests.get(cacheKey);
        if (pending) {
            console.debug(`[DocsDevCache] Waiting for in-flight request for S3 docs definition: ${cacheKey}`);
            return pending;
        }

        // Start a new request and track it
        console.debug(`[DocsDevCache] Cache miss for S3 docs definition: ${cacheKey}`);
        const requestPromise = (async () => {
            try {
                const response = await uncachedLoadDocsDefinitionFromS3(domain, docsBucketName);
                // Once resolved, store in cache and remove from pending
                if (response != null) {
                    docsDevCache.set(cacheKey, response);
                    console.debug(`[DocsDevCache] Cached S3 docs definition: ${cacheKey}`);
                }
                pendingRequests.delete(cacheKey);
                console.debug(`[DocsDevCache] Cleaned up pending request for S3 docs definition: ${cacheKey}`);
                return response;
            } catch (error) {
                // On error, remove from pending and re-throw
                pendingRequests.delete(cacheKey);
                console.error(
                    `[DocsDevCache] Error loading S3 docs definition ${cacheKey}, cleaned up pending request:`,
                    error
                );
                throw error;
            }
        })();

        pendingRequests.set(cacheKey, requestPromise);
        return requestPromise;
    }

    // For non-dev environments, use React cache
    return cachedLoadDocsDefinitionFromS3(domain, docsBucketName);
};

const cachedLoadDocsDefinitionFromS3 = cache(
    async (domain: string, docsBucketName: string): Promise<FdrAPI.docs.v2.read.LoadDocsForUrlResponse | undefined> => {
        return uncachedLoadDocsDefinitionFromS3(domain, docsBucketName);
    }
);

const MAX_S3_FETCH_RETRIES = 2;
const S3_RETRY_DELAY_MS = 500;

const uncachedLoadDocsDefinitionFromS3 = async (
    domain: string,
    docsBucketName: string
): Promise<FdrAPI.docs.v2.read.LoadDocsForUrlResponse | undefined> => {
    const cleanDomain = domain.replace(/^https?:\/\//, "");
    const s3Key = getS3KeyForV1DocsDefinition(cleanDomain);

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_S3_FETCH_RETRIES + 1; attempt++) {
        try {
            const signedUrl = await getSignedUrl({
                Bucket: docsBucketName,
                Key: s3Key,
                expiresIn: 60 * 60 // 1 hour
            });

            const response = await fetch(signedUrl, {
                next: { tags: [domain, "loadDocsDefinitionFromS3"] }
            });

            if (response.ok) {
                if (attempt > 1) {
                    console.warn(
                        `[S3 Retry] Successfully loaded docs definition from S3 on attempt ${attempt}/${MAX_S3_FETCH_RETRIES + 1} for domain: ${cleanDomain}`
                    );
                } else {
                    console.debug("Successfully loaded docs definition from S3: ", signedUrl);
                }
                const json = await response.json();
                return json as FdrAPI.docs.v2.read.LoadDocsForUrlResponse;
            }
            throw new Error(
                `Failed to load docs definition from S3. Status: ${response.status}. Error: ${await response.text()}`
            );
        } catch (error) {
            lastError = error;
            if (attempt <= MAX_S3_FETCH_RETRIES) {
                console.warn(
                    `[S3 Retry] Attempt ${attempt}/${MAX_S3_FETCH_RETRIES + 1} failed for domain: ${cleanDomain}, retrying in ${S3_RETRY_DELAY_MS}ms`,
                    error
                );
                await new Promise((resolve) => setTimeout(resolve, S3_RETRY_DELAY_MS));
            }
        }
    }

    console.error(`[S3 Retry] All ${MAX_S3_FETCH_RETRIES + 1} attempts failed for domain: ${cleanDomain}`, lastError);
    return undefined;
};
