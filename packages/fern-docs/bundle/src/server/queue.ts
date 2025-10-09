import { Client } from "@upstash/qstash";
import { getEnv } from "@vercel/functions";

import { qstashToken } from "@fern-api/docs-server/env-variables";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { cleanBasePath } from "@fern-api/docs-server/utils/clean-base-path";
import { HEADER_X_FERN_HOST, HEADER_X_VERCEL_PROTECTION_BYPASS, slugToHref } from "@fern-api/docs-utils";

import { isSelfHosted } from "./isSelfHosted";

const q =
    isLocal() || isSelfHosted()
        ? undefined
        : new Client({
              token: qstashToken(),
              baseUrl: "https://qstash.upstash.io"
          });

export async function queue<TBody = unknown>({
    host,
    domain,
    basepath: basepathProp,
    endpoint: endpointProp,
    disableVercelPreviewDeployment = false,
    timeoutSeconds,
    ...request
}: {
    /**
     * the host of the docs (might be different from the domain, in the case of reverse proxies)
     */
    host: string;
    /**
     * the domain of the docs (will be added to the x-fern-host header)
     */
    domain: string;
    basepath?: string;
    endpoint: `/api/fern-docs/${string}`;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD";
    timeoutSeconds?: number;
    body?: TBody;
    headers?: HeadersInit;
    retries?: number;
    deduplicationId?: string;
    disableVercelPreviewDeployment?: boolean;
}): Promise<void> {
    if (isLocal() || isSelfHosted() || q === undefined) {
        return undefined;
    }

    const { VERCEL, VERCEL_ENV, VERCEL_AUTOMATION_BYPASS_SECRET } = getEnv();

    if (!VERCEL || VERCEL_ENV === "development") {
        return undefined;
    }

    if (disableVercelPreviewDeployment && VERCEL_ENV !== "production") {
        return undefined;
    }

    const headers = new Headers(request?.headers);

    // add x-fern-host header to identify the docs domain (for compatibility with vercel preview urls)
    headers.set(HEADER_X_FERN_HOST, domain);

    if (VERCEL_AUTOMATION_BYPASS_SECRET) {
        headers.set(HEADER_X_VERCEL_PROTECTION_BYPASS, VERCEL_AUTOMATION_BYPASS_SECRET);
    }

    const basepath = cleanBasePath(basepathProp);
    const endpoint = slugToHref(endpointProp);

    await q.publishJSON({
        url: `https://${host}${basepath}${endpoint}`,
        retries: 1,
        ...request,
        method: request.method === "HEAD" ? "GET" : request.method,
        headers,
        timeout: timeoutSeconds ? `${BigInt(timeoutSeconds)}s` : undefined
    });
}

export async function queueWithMessageId<TBody = unknown>({
    host,
    domain,
    basepath: basepathProp,
    endpoint: endpointProp,
    disableVercelPreviewDeployment = false,
    method,
    timeoutSeconds,
    callback,
    ...request
}: {
    /**
     * the host of the docs (might be different from the domain, in the case of reverse proxies)
     */
    host: string;
    /**
     * the domain of the docs (will be added to the x-fern-host header)
     */
    domain: string;
    basepath?: string;
    endpoint: `/api/fern-docs/${string}`;
    /**
     * queueName must be alphanumeric, hyphen, underscore, or period
     */
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    timeoutSeconds?: number;
    body?: TBody;
    headers?: HeadersInit;
    retries?: number;
    deduplicationId?: string;
    disableVercelPreviewDeployment?: boolean;
    /**
     * URL to POST to when the job completes (success or failure)
     */
    callback?: string;
}): Promise<string | undefined> {
    if (isLocal() || isSelfHosted() || q === undefined) {
        return undefined;
    }

    const { VERCEL, VERCEL_ENV, VERCEL_AUTOMATION_BYPASS_SECRET } = getEnv();

    if (!VERCEL || VERCEL_ENV === "development") {
        return undefined;
    }

    if (disableVercelPreviewDeployment && VERCEL_ENV !== "production") {
        return undefined;
    }

    const headers = new Headers(request?.headers);

    // add x-fern-host header to identify the docs domain (for compatibility with vercel preview urls)
    headers.set(HEADER_X_FERN_HOST, domain);

    if (VERCEL_AUTOMATION_BYPASS_SECRET) {
        headers.set(HEADER_X_VERCEL_PROTECTION_BYPASS, VERCEL_AUTOMATION_BYPASS_SECRET);
    }

    const basepath = cleanBasePath(basepathProp);
    const endpoint = slugToHref(endpointProp);

    const response = await q.publishJSON({
        url: `https://${host}${basepath}${endpoint}`,
        headers,
        method,
        timeout: timeoutSeconds ? `${BigInt(timeoutSeconds)}s` : undefined,
        callback
    });

    if ("messageId" in response) {
        return response.messageId;
    }

    return undefined;
}

export async function batchQueue<TBody = unknown>({
    queueName,
    parallelism = 10,
    requests,
    ...baseRequest
}: {
    /**
     * queueName must be alphanumeric, hyphen, underscore, or period
     */
    queueName?: string;
    parallelism?: number;
    endpoint: `/api/fern-docs/${string}`;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD";
    requests: {
        /**
         * the host of the docs (might be different from the domain, in the case of reverse proxies)
         */
        host: string;
        /**
         * the domain of the docs (will be added to the x-fern-host header)
         */
        domain: string;
        /**
         * the basepath of the docs (will be added to the url)
         */
        basepath?: string;

        /**
         * deduplicationId must be alphanumeric, hyphen, underscore, or period
         */
        deduplicationId?: string;
    }[];
    body?: TBody;
    headers?: HeadersInit;
    retries?: number;
}): Promise<void> {
    if (isLocal() || q === undefined || isSelfHosted()) {
        return;
    }

    const { VERCEL_AUTOMATION_BYPASS_SECRET } = getEnv();

    if (queueName) {
        await q.queue({ queueName }).upsert({ parallelism });
    }

    const batchRequests = requests.map(({ host, domain, basepath: basepathProp, deduplicationId }) => {
        const headers = new Headers(baseRequest.headers);

        // add x-fern-host header to identify the docs domain (for compatibility with vercel preview urls)
        headers.set(HEADER_X_FERN_HOST, domain);

        if (VERCEL_AUTOMATION_BYPASS_SECRET) {
            headers.set(HEADER_X_VERCEL_PROTECTION_BYPASS, VERCEL_AUTOMATION_BYPASS_SECRET);
        }

        const basepath = cleanBasePath(basepathProp);
        const endpoint = slugToHref(baseRequest.endpoint);

        return {
            queueName,
            url: `https://${host}${basepath}${endpoint}`,
            retries: 1,
            ...baseRequest,
            headers,
            deduplicationId
        };
    });

    // Process requests individually to handle failures gracefully, ensuring messages are put in the specified queueName
    const results = await Promise.allSettled(
        batchRequests.map(async (request) => {
            try {
                // Use the .queue(queueName).publishJSON(...) API to ensure the message is put in the queue
                await q.queue({ queueName: request.queueName }).enqueueJSON({
                    queueName: request.queueName,
                    url: request.url,
                    method: request.method as any,
                    headers: request.headers,
                    body: request.body,
                    retries: request.retries,
                    deduplicationId: request.deduplicationId
                });
            } catch (error) {
                console.error(`[batchQueue] Failed to queue request for ${request.url}:`, error);
                throw error;
            }
        })
    );

    // Log any failures
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
        console.error(`[batchQueue] ${failures.length} out of ${batchRequests.length} requests failed to queue`);
        failures.forEach((failure) => {
            console.error("[batchQueue] Request failure:", failure.reason);
        });
    }

    console.log(`[batchQueue] Successfully queued ${batchRequests.length - failures.length} requests`);
}

export async function getMessageStatus(messageId: string): Promise<"completed" | "failed" | "in_progress"> {
    const response = await q?.logs({
        filter: {
            messageId
        }
    });
    if (response) {
        const state = response.logs[0]?.state;
        if (state === "DELIVERED") {
            return "completed";
        } else if (
            state === "CREATED" ||
            state === "ACTIVE" ||
            state === "RETRY" ||
            state === "IN_PROGRESS" ||
            state === "ERROR"
        ) {
            return "in_progress";
        } else {
            return "failed";
        }
    }
    return "failed";
}
