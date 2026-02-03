import {
    CACHE_KEY_CONFIG,
    CACHE_KEY_FILES,
    CACHE_KEY_MDX_BUNDLER_FILES,
    CACHE_KEY_METADATA,
    CACHE_KEY_ROOT,
    convertResponseToRootNode,
    createEndpointCacheKey,
    createPageCacheKey,
    getMetadataFromResponse
} from "@fern-api/docs-loader";
import { flushPosthog, track } from "@fern-api/docs-server";
import { fernToken_admin } from "@fern-api/docs-server/env-variables";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { loadWithUrl } from "@fern-api/docs-server/loadWithUrl";
import {
    EVERYONE_ROLE,
    encodeBool,
    encodeRoles,
    HEADER_X_FERN_HOST,
    HEADER_X_FERN_REVALIDATE_AUTH,
    slugToHref,
    withoutStaging
} from "@fern-api/docs-utils";
import { type ApiDefinition, type DocsV2Read, FernNavigation } from "@fern-api/fdr-sdk";
import {
    ApiDefinitionV1ToLatest,
    type EndpointId,
    prune,
    type WebhookId,
    type WebSocketId
} from "@fern-api/fdr-sdk/api-definition";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { getEdgeFlags } from "@fern-docs/edge-config";
import { getEnv, waitUntil } from "@vercel/functions";
import { kv } from "@vercel/kv";
import { mapValues } from "es-toolkit/object";
import { escapeRegExp } from "es-toolkit/string";
import { revalidatePath, revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { UnreachableCaseError } from "ts-essentials";
import { getFaiClient } from "@/getFaiClient";
import { queueAlgoliaReindex } from "@/server/queue-reindex";
import { ResilientQueue } from "@/utils/resilient-queue";
import { createSafeStreamController } from "@/utils/safe-stream-controller";

// Custom error type for intentional revalidation failures
class RevalidationError extends Error {
    constructor(
        message: string,
        public readonly url: string,
        public readonly status?: number
    ) {
        super(message);
        this.name = "RevalidationError";
    }
}

interface RevalidationController {
    log(message: string): void;
}
export const maxDuration = 800; // 13 minutes timeout

async function performRevalidation(params: {
    host: string;
    domain: string;
    origin: string;
    controller: RevalidationController;
    doReindex: boolean;
    doRegenerate: boolean;
    cdnUri: string | undefined;
    authHeader: string | null;
    start: number;
    useGetRequests: boolean;
}): Promise<void> {
    const { host, domain, origin, controller, doReindex, doRegenerate, cdnUri, authHeader, start, useGetRequests } =
        params;

    const fetchMethod = useGetRequests ? "GET" : "HEAD";
    if (useGetRequests) {
        controller.log(`using GET requests instead of HEAD\n`);
    }

    try {
        await kv.del(domain);
    } catch (e) {
        console.debug("Attempted to delete key", domain, "but failed with", e);
    }

    const deploymentId = getEnv().VERCEL_DEPLOYMENT_ID ?? "development";
    const oldSuggestionsKey = `docs:${deploymentId}:${domain}:suggestions`;
    try {
        await kv.del(oldSuggestionsKey);
    } catch (e) {
        console.debug("Attempted to delete old suggestions key", oldSuggestionsKey, "but failed with", e);
    }

    if (cdnUri) {
        waitUntil(kv.sadd(`${cdnUri}:domains`, domain));
    }

    controller.log(`revalidating:${domain}\n`);

    const loadWithUrlPromise = loadWithUrl(domain);

    const [docs, edgeFlags, metadata] = await Promise.all([
        loadWithUrlPromise,
        getEdgeFlags(domain),
        getMetadataFromResponse(withoutStaging(domain), loadWithUrlPromise)
    ]);

    let reindexPromise: Promise<void> | undefined;
    if (doReindex) {
        reindexPromise = reindex(docs, host, domain, maxDuration)
            .then((services) => {
                controller.log(`reindex-queued:services=${services.join(",")}\n`);
            })
            .catch((e: unknown) => {
                console.error(`[revalidate:reindex] ${JSON.stringify(e)}`);
                controller.log(`reindex-failed:error=${escapeRegExp(String(e))}\n`);
            });
    }

    const cacheEndpoints = [
        { path: "/api/fern-docs/llms-full.txt", name: "llms-full" },
        { path: "/api/fern-docs/favicon.ico", name: "api-favicon" },
        { path: "/favicon.ico", name: "base-favicon" }
    ];

    const cachePromises = cacheEndpoints.map(({ path, name }) =>
        fetch(`${origin}${path}`, {
            method: fetchMethod,
            headers: { [HEADER_X_FERN_HOST]: domain },
            signal: AbortSignal.timeout(600_000)
        })
            .then(() => {
                controller.log(`${name}-revalidated\n`);
            })
            .catch((e: unknown) => {
                console.error(`[revalidate:${name}-revalidate] error: ${JSON.stringify(e)}`);
                controller.log(`${name}-revalidate-failed:error=${escapeRegExp(String(e))}\n`);
            })
    );

    // Check for orphaned file references in page content
    const fileIds = new Set(Object.keys(docs.definition.filesV2));
    for (const [pageId, page] of Object.entries(docs.definition.pages)) {
        const matches = page.markdown.matchAll(/file:([a-f0-9-]+)/gi);
        for (const match of matches) {
            if (match[1] && !fileIds.has(match[1])) {
                track("asset_error", {
                    type: "orphaned_file_reference",
                    domain,
                    pageId,
                    fileId: match[1]
                });
            }
        }
    }

    const root = convertResponseToRootNode(docs, edgeFlags);

    try {
        const keys: Record<string, unknown> = {};

        keys[CACHE_KEY_METADATA] = metadata;

        if (root != null) {
            keys[CACHE_KEY_ROOT] = root;
        }

        const { navigation, root: _, ...config } = docs.definition.config;
        keys[CACHE_KEY_CONFIG] = config;

        Object.entries(docs.definition.pages).forEach(([id, page]) => {
            keys[createPageCacheKey({ pageId: id })] = page;
        });

        Object.values(docs.definition.apisV2).forEach((api) => {
            const prunedApi = createPrunedApi(api);
            prunedApi.forEach((value, key) => {
                keys[`api:${key}`] = value;
            });
        });

        Object.values(docs.definition.apis).forEach((api) => {
            const prunedApi = createPrunedApi(ApiDefinitionV1ToLatest.from(api).migrate());
            prunedApi.forEach((value, key) => {
                keys[`api:${key}`] = value;
            });
        });

        keys[CACHE_KEY_FILES] = mapValues(docs.definition.filesV2, (file) => {
            if (file.type === "url") {
                return {
                    src:
                        process.env.NEXT_PUBLIC_ASSET_HOSTING === "1"
                            ? file.url.replace(getFileCDN(), `${metadata.basePath ?? ""}/_files`)
                            : file.url
                };
            } else if (file.type === "image") {
                return {
                    src:
                        process.env.NEXT_PUBLIC_ASSET_HOSTING === "1"
                            ? file.url.replace(getFileCDN(), `${metadata.basePath ?? ""}/_files`)
                            : file.url,
                    width: file.width,
                    height: file.height,
                    blurDataURL: file.blurDataUrl,
                    alt: file.alt
                };
            }
            throw new UnreachableCaseError(file);
        });

        keys[CACHE_KEY_MDX_BUNDLER_FILES] = docs.definition.jsFiles ?? {};

        const promises = [];

        for (const [key, value] of Object.entries(keys)) {
            promises.push(kv.hset(domain, { [key]: value }));
        }

        const results = await Promise.allSettled(promises);

        const keyNames = Object.keys(keys);
        const failedKeys: string[] = [];

        results.forEach((result, index) => {
            if (result.status === "rejected") {
                const keyName = keyNames[index] ?? `unknown-${index}`;
                failedKeys.push(keyName);
                console.error(`Failed to set kv key ${keyName}: ${result.reason}`);
                track("asset_error", {
                    type: "revalidate_kv_key_failed",
                    domain,
                    key: keyName,
                    error: String(result.reason)
                });
            }
        });

        const filesCount = Object.keys((keys[CACHE_KEY_FILES] as Record<string, unknown>) ?? {}).length;

        if (failedKeys.length > 0) {
            track("asset_error", {
                type: "revalidate_kv_write",
                domain,
                keysCount: keyNames.length,
                filesCount,
                failedKeysCount: failedKeys.length,
                failedKeys: failedKeys.slice(0, 25)
            });
        }

        controller.log(`revalidate-kv-keys-set:${keyNames.length}\n`);
    } catch (e) {
        console.error(`[revalidate:start] ${JSON.stringify(e)}`);
        track("asset_error", {
            type: "revalidate_kv_write_error",
            domain,
            error: String(e)
        });
        controller.log(`revalidate-kv-keys-set-failed:error=${escapeRegExp(String(e))}\n`);
    }

    // Delay to ensure KV writes propagate before page regeneration reads them
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (doRegenerate) {
        const createRevalidationQueue = (
            slugs: string[],
            authParams: { requiresLogin: boolean; isLoggedIn: boolean },
            label: string
        ) => {
            const queue = new ResilientQueue<string>({
                processItem: async (slug: string, attempt: number) => {
                    const url = withDefaultProtocol(`${domain}${slugToHref(slug)}`);

                    // Path order: [requiresLogin]/[isLoggedIn]/[roles]
                    const requiresLoginParam = encodeBool(authParams.requiresLogin);
                    const isLoggedInParam = encodeBool(authParams.isLoggedIn);
                    const rolesParam = encodeRoles([EVERYONE_ROLE]);
                    revalidatePath(
                        `/${host}/${domain}/${requiresLoginParam}/${isLoggedInParam}/${rolesParam}/${encodeURIComponent(slugToHref(slug))}`,
                        "page"
                    );

                    const startTime = performance.now();

                    try {
                        const res = await fetch(`${origin}${slugToHref(slug)}`, {
                            method: fetchMethod,
                            headers: {
                                [HEADER_X_FERN_HOST]: domain,
                                [HEADER_X_FERN_REVALIDATE_AUTH]: `requiresLogin:${authParams.requiresLogin},isLoggedIn:${authParams.isLoggedIn},token:${fernToken_admin()}`
                            },
                            signal: AbortSignal.timeout(600_000)
                        });

                        const endTime = performance.now();

                        track("revalidate_page_stats", {
                            url,
                            domain,
                            durationMs: endTime - startTime,
                            status: res?.status ?? null,
                            ok: res?.ok ?? false,
                            attempt,
                            authMode: label
                        });

                        if (!res?.ok) {
                            track("revalidate_page_error_res_not_ok", {
                                url,
                                domain,
                                status: res?.status ?? null,
                                error: `Failed to revalidate ${url}. Status code: ${res?.status}`,
                                attempt,
                                authMode: label
                            });
                            throw new RevalidationError(
                                `Failed to revalidate ${url}. Status code: ${res?.status}`,
                                url,
                                res?.status
                            );
                        }

                        controller.log(`revalidated[${label}]:${url}\n`);
                    } catch (e) {
                        console.error(
                            `[revalidate:page-revalidate] error: url=${url}; attempt=${attempt}; authMode=${label}; error=${JSON.stringify((e as Error)?.message)}`
                        );

                        if (!(e instanceof RevalidationError)) {
                            const errorMessage = String(e);
                            const errorDetails: any = {};

                            if (e && typeof e === "object" && "cause" in e && e.cause !== undefined) {
                                errorDetails.cause = e.cause;
                            }

                            track("revalidate_page_error_unexpected", {
                                url,
                                domain,
                                error: errorMessage,
                                errorDetails,
                                attempt,
                                authMode: label
                            });
                        }

                        throw e;
                    }
                },
                maxRetries: 3,
                initialConcurrency: 50,
                maxConcurrency: 150,
                minConcurrency: 5,
                errorRateThreshold: 0.2,
                backoffBaseMs: 1000,
                onProgress: (stats) => {
                    controller.log(
                        `revalidate-progress[${label}]:completed=${stats.completed}/${stats.total};` +
                            `failed=${stats.failed};inFlight=${stats.inFlight};` +
                            `concurrency=${stats.currentConcurrency};errorRate=${(stats.errorRate * 100).toFixed(1)}%\n`
                    );
                }
            });
            return queue.process(slugs);
        };

        // Revalidate all pages, grouping by auth requirement
        const collector = FernNavigation.NodeCollector.collect(root);
        const { authedSlugs, unauthedSlugs } = collector.revalidationPageSlugs;

        // Revalidate unauthed pages first
        if (unauthedSlugs.length > 0) {
            controller.log(`revalidate-queued[unauth]:urls=${unauthedSlugs.length}\n`);

            const unauthResult = await createRevalidationQueue(
                unauthedSlugs,
                { requiresLogin: false, isLoggedIn: false },
                "unauth"
            );

            if (unauthResult.failed > 0) {
                console.error(`[revalidate] ${unauthResult.failed} unauth pages failed permanently after ${3} retries`);
                track("revalidate_pages_failed_permanently", {
                    domain,
                    failedCount: unauthResult.failed,
                    totalCount: unauthResult.total,
                    authMode: "unauth"
                });
            }

            controller.log(
                `revalidate-pages-finished[unauth]:total=${unauthResult.total};` +
                    `completed=${unauthResult.completed};failed=${unauthResult.failed}\n`
            );
        }

        // Revalidate authed pages
        if (authedSlugs.length > 0) {
            controller.log(`revalidate-queued[auth]:urls=${authedSlugs.length}\n`);

            const authResult = await createRevalidationQueue(
                authedSlugs,
                { requiresLogin: true, isLoggedIn: true },
                "auth"
            );

            if (authResult.failed > 0) {
                console.error(`[revalidate] ${authResult.failed} auth pages failed permanently after ${3} retries`);
                track("revalidate_pages_failed_permanently", {
                    domain,
                    failedCount: authResult.failed,
                    totalCount: authResult.total,
                    authMode: "auth"
                });
            }

            controller.log(
                `revalidate-pages-finished[auth]:total=${authResult.total};` +
                    `completed=${authResult.completed};failed=${authResult.failed}\n`
            );
        }
    }

    if (
        authHeader != null &&
        process.env.NEXT_PUBLIC_DASHBOARD_URL != null &&
        process.env.NEXT_PUBLIC_DASHBOARD_URL !== ""
    ) {
        try {
            await fetch(new URL("/api/generate-homepage-images", process.env.NEXT_PUBLIC_DASHBOARD_URL), {
                method: "POST",
                headers: {
                    authorization: authHeader
                },
                body: JSON.stringify({
                    url: `${docs.baseUrl.domain.replace(/\/$/, "")}${docs.baseUrl.basePath ?? ""}`
                }),
                signal: AbortSignal.timeout(600_000)
            });
        } catch (e) {
            console.error(`[revalidate:homepage-image-revalidate] error: ${JSON.stringify(e)}`);
        }
    }

    await reindexPromise;
    await Promise.all(cachePromises);

    const end = performance.now();
    controller.log(`revalidate-finished:${end - start}ms\n`);

    // Flush PostHog events before the function terminates
    await flushPosthog();
}

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ host: string; domain: string }> }
): Promise<NextResponse> {
    if (isLocal() || isSelfHosted()) {
        throw new Error("revalidation is only available in production");
    }

    const cdnUri = process.env.NEXT_PUBLIC_CDN_URI;
    const start = performance.now();

    const { host, domain } = await props.params;
    revalidateTag(domain);

    const shouldRegenerateParam = req.nextUrl.searchParams.get("regenerate");
    if (shouldRegenerateParam !== "false") {
        revalidateTag(`${domain}:mdx`);
    }

    // delay to ensure invalidation propagates before cache is accessed
    await new Promise((resolve) => setTimeout(resolve, 500));

    const fromDeploymentPromoted = req.nextUrl.searchParams.get("fromDeploymentPromoted") === "true";

    if (fromDeploymentPromoted) {
        const controller: RevalidationController = {
            log: (message: string) => console.log(`[revalidate:${domain}] ${message.trim()}`)
        };

        try {
            const metadata = await getMetadataFromResponse(withoutStaging(domain), loadWithUrl(domain));
            const doReindex = !metadata.isPreview && req.nextUrl.searchParams.get("reindex") !== "false";
            const doRegenerate = !metadata.isPreview && req.nextUrl.searchParams.get("regenerate") !== "false";
            const useGetRequests = req.nextUrl.searchParams.get("useGetRequests") === "true";

            await performRevalidation({
                host,
                domain,
                origin: req.nextUrl.origin,
                controller,
                doReindex,
                doRegenerate,
                cdnUri,
                authHeader: req.headers.get("authorization"),
                start,
                useGetRequests
            });

            return new NextResponse("OK", { status: 200 });
        } catch (e) {
            console.error(`[revalidate] ${JSON.stringify(e)}`);

            if (e instanceof RevalidationError) {
                track("revalidate_intentional_failure", {
                    url: e.url,
                    domain,
                    status: e.status,
                    error: e.message
                });
            } else {
                track("revalidate_unexpected_error", {
                    domain,
                    error: String(e)
                });
            }

            return new NextResponse("Internal Server Error", { status: 500 });
        }
    }

    const stream = new ReadableStream({
        async start(controller) {
            const c = createSafeStreamController(controller, "[revalidate]");

            try {
                const streamController: RevalidationController = {
                    log: (message: string) => {
                        console.log(`[revalidate:${domain}] ${message.trim()}`);
                        c.enqueue(message);
                    }
                };

                const metadata = await getMetadataFromResponse(withoutStaging(domain), loadWithUrl(domain));
                const doReindex = !metadata.isPreview && req.nextUrl.searchParams.get("reindex") !== "false";
                const doRegenerate = !metadata.isPreview && req.nextUrl.searchParams.get("regenerate") !== "false";
                const useGetRequests = req.nextUrl.searchParams.get("useGetRequests") === "true";

                await performRevalidation({
                    host,
                    domain,
                    origin: req.nextUrl.origin,
                    controller: streamController,
                    doReindex,
                    doRegenerate,
                    cdnUri,
                    authHeader: req.headers.get("authorization"),
                    start,
                    useGetRequests
                });
            } catch (e) {
                console.error(`[revalidate] ${JSON.stringify(e)}`);

                if (e instanceof RevalidationError) {
                    track("revalidate_intentional_failure", {
                        url: e.url,
                        domain,
                        status: e.status,
                        error: e.message
                    });
                } else {
                    track("revalidate_unexpected_error", {
                        domain,
                        error: String(e)
                    });
                }

                c.enqueue(`revalidate-failed:error=${escapeRegExp(String(e))}\n`);
            } finally {
                c.close();
            }
        }
    });

    return new NextResponse(stream, {
        headers: {
            "Content-Type": "text/event-stream"
        }
    });
}

async function reindex(docs: DocsV2Read.LoadDocsForUrlResponse, host: string, domain: string, maxDuration: number) {
    const { basePath } = docs.baseUrl;

    await queueAlgoliaReindex(host, withoutStaging(domain), basePath);

    const faiClient = getFaiClient({
        token: process.env.FERN_TOKEN ?? ""
    });

    const { ask_ai_enabled: isAskAiEnabled } = await faiClient.settings.getDocsSettings({ domain });

    if (isAskAiEnabled) {
        await faiClient.settings.reindexAskAi({ domain: withoutStaging(domain) });
        return ["algolia", "turbopuffer"];
    }
    return ["algolia"];
}

function createPrunedApi(api: ApiDefinition.ApiDefinition) {
    const apis = new Map<string, ApiDefinition.ApiDefinition>();
    Object.keys(api.endpoints).forEach((endpointId) => {
        const pruneKey = {
            type: "endpoint",
            endpointId: endpointId as EndpointId
        } as const;
        apis.set(`${api.id}:${createEndpointCacheKey(pruneKey)}`, prune(api, pruneKey));
    });
    Object.keys(api.websockets).forEach((webSocketId) => {
        const pruneKey = {
            type: "webSocket",
            webSocketId: webSocketId as WebSocketId
        } as const;
        apis.set(`${api.id}:${createEndpointCacheKey(pruneKey)}`, prune(api, pruneKey));
    });
    Object.keys(api.webhooks).forEach((webhookId) => {
        const pruneKey = {
            type: "webhook",
            webhookId: webhookId as WebhookId
        } as const;
        apis.set(`${api.id}:${createEndpointCacheKey(pruneKey)}`, prune(api, pruneKey));
    });
    return apis;
}

function getFileCDN() {
    return (
        (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_FILES_ORIGIN : undefined) ??
        "https://files.buildwithfern.com"
    );
}
