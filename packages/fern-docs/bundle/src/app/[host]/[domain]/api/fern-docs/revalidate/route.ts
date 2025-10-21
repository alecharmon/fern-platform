import { convertResponseToRootNode, createEndpointCacheKey, getMetadataFromResponse } from "@fern-api/docs-loader";
import { track } from "@fern-api/docs-server";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { loadWithUrl } from "@fern-api/docs-server/loadWithUrl";
import { pruneWithAuthState } from "@fern-api/docs-server/withRbac";
import { HEADER_X_FERN_HOST, slugToHref, withoutStaging } from "@fern-api/docs-utils";
import { type ApiDefinition, type DocsV2Read, FernNavigation } from "@fern-api/fdr-sdk";
import {
    ApiDefinitionV1ToLatest,
    type EndpointId,
    prune,
    type WebhookId,
    type WebSocketId
} from "@fern-api/fdr-sdk/api-definition";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { getAuthEdgeConfig, getEdgeFlags } from "@fern-docs/edge-config";
import { getEnv, waitUntil } from "@vercel/functions";
import { kv } from "@vercel/kv";
import { chunk } from "es-toolkit/array";
import { mapValues } from "es-toolkit/object";
import { escapeRegExp } from "es-toolkit/string";
import { revalidatePath, revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { UnreachableCaseError } from "ts-essentials";
import { Agent, fetch } from "undici";
import { getFaiClient } from "@/getFaiClient";
import { queueAlgoliaReindex, queueTurbopufferReindex } from "@/server/queue-reindex";

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

// Create persistent HTTP connection pool to avoid EMFILE errors
// Reuses connections across all fetches to the same origin
const revalidationAgent = new Agent({
    connections: 20, // Max concurrent connections per origin
    pipelining: 10, // Max requests per connection
    keepAliveTimeout: 30000, // Keep connections alive for 30s
    keepAliveMaxTimeout: 60000
});

export const maxDuration = 800; // 13 minutes timeout

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

    // delay to ensure invalidation propagates before cache is accessed
    await new Promise((resolve) => setTimeout(resolve, 100));

    const stream = new ReadableStream({
        async start(controller) {
            try {
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

                // note: adds to "domain" for deployment-promoted webhook
                if (cdnUri) {
                    waitUntil(kv.sadd(`${cdnUri}:domains`, domain));
                }

                controller.enqueue(`revalidating:${domain}\n`);

                const loadWithUrlPromise = loadWithUrl(domain);

                const [docs, edgeFlags, metadata, authConfig] = await Promise.all([
                    loadWithUrlPromise,
                    getEdgeFlags(domain),
                    getMetadataFromResponse(withoutStaging(domain), loadWithUrlPromise),
                    getAuthEdgeConfig(domain)
                ]);

                let reindexPromise: Promise<void> | undefined;
                if (
                    !metadata.isPreview &&
                    // reindex unless explicitly disabled
                    req.nextUrl.searchParams.get("reindex") !== "false"
                ) {
                    reindexPromise = reindex(docs, host, domain, maxDuration)
                        .then((services) => {
                            controller.enqueue(`reindex-queued:services=${services.join(",")}\n`);
                        })
                        .catch((e: unknown) => {
                            console.error(`[revalidate:reindex] ${JSON.stringify(e)}`);
                            controller.enqueue(`reindex-failed:error=${escapeRegExp(String(e))}\n`);
                        });
                }

                // Revalidate cache endpoints
                const cacheEndpoints = [
                    { path: "/api/fern-docs/llms-full.txt", name: "llms-full" },
                    { path: "/api/fern-docs/favicon.ico", name: "api-favicon" },
                    { path: "/favicon.ico", name: "base-favicon" }
                ];

                const cachePromises = cacheEndpoints.map(({ path, name }) =>
                    fetch(`${req.nextUrl.origin}${path}`, {
                        method: "HEAD",
                        headers: { [HEADER_X_FERN_HOST]: domain },
                        signal: AbortSignal.timeout(600_000),
                        dispatcher: revalidationAgent
                    })
                        .then(() => {
                            controller.enqueue(`${name}-revalidated\n`);
                        })
                        .catch((e: unknown) => {
                            console.error(`[revalidate:${name}-revalidate] error: ${JSON.stringify(e)}`);
                            controller.enqueue(`${name}-revalidate-failed:error=${escapeRegExp(String(e))}\n`);
                        })
                );

                const root = convertResponseToRootNode(docs, edgeFlags);
                let staticRoot = root;

                // maybe prune the root node if we have an auth config
                if (staticRoot && authConfig) {
                    staticRoot = pruneWithAuthState(
                        {
                            authed: false,
                            authorizationUrl: undefined,
                            partner: undefined,
                            ok: true
                        },
                        authConfig,
                        staticRoot
                    );
                }

                try {
                    const keys: Record<string, unknown> = {};

                    keys.metadata = metadata;

                    if (root != null) {
                        keys.root = root;
                    }

                    const { navigation, root: _, ...config } = docs.definition.config;
                    keys.config = config;

                    Object.entries(docs.definition.pages).forEach(([id, page]) => {
                        keys[`page:${id}`] = page;
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

                    keys[`${domain}:files`] = mapValues(docs.definition.filesV2, (file) => {
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

                    keys[`mdx-bundler-files`] = docs.definition.jsFiles ?? {};

                    const promises = [];

                    for (const [key, value] of Object.entries(keys)) {
                        promises.push(kv.hset(domain, { [key]: value }));
                    }

                    const results = await Promise.allSettled(promises);

                    results.forEach((result, index) => {
                        if (result.status === "rejected") {
                            console.error(`Failed to set kv key ${Object.keys(keys)[index]}: ${result.reason}`);
                        }
                    });

                    controller.enqueue(`revalidate-kv-keys-set:${Object.keys(keys).length}\n`);
                } catch (e) {
                    console.error(`[revalidate:start] ${JSON.stringify(e)}`);
                    controller.enqueue(`revalidate-kv-keys-set-failed:error=${escapeRegExp(String(e))}\n`);
                }

                if (req.nextUrl.searchParams.get("regenerate") !== "false") {
                    const collector = FernNavigation.NodeCollector.collect(staticRoot);
                    const batches = chunk(collector.staticPageSlugs, 200);

                    controller.enqueue(`revalidate-queued:urls=${collector.slugs.length};batches=${batches.length}\n`);

                    for (let i = 0; i < batches.length; i++) {
                        controller.enqueue(
                            `revalidate-batch:${i * 200 + 1}-${Math.min(
                                (i + 1) * 200,
                                collector.slugs.length
                            )}/${collector.slugs.length}\n`
                        );
                        await Promise.all(
                            (batches[i] ?? []).map(async (slug: string) => {
                                const url = withDefaultProtocol(`${domain}${slugToHref(slug)}`);
                                // force revalidate the static page
                                revalidatePath(
                                    `/${host}/${domain}/static/${encodeURIComponent(slugToHref(slug))}`,
                                    "page"
                                );
                                const startTime = performance.now();
                                try {
                                    const res = await fetch(`${req.nextUrl.origin}${slugToHref(slug)}`, {
                                        method: "HEAD",
                                        headers: { [HEADER_X_FERN_HOST]: domain },
                                        signal: AbortSignal.timeout(600_000),
                                        dispatcher: revalidationAgent
                                    });
                                    const endTime = performance.now();
                                    track("revalidate_page_stats", {
                                        url,
                                        domain,
                                        durationMs: endTime - startTime,
                                        status: res?.status ?? null,
                                        ok: res?.ok ?? false
                                    });
                                    if (!res?.ok) {
                                        track("revalidate_page_error_res_not_ok", {
                                            url,
                                            domain,
                                            status: res?.status ?? null,
                                            error: `Failed to revalidate ${url}. Status code: ${res?.status}`
                                        });
                                        throw new RevalidationError(
                                            `Failed to revalidate ${url}. Status code: ${res?.status}`,
                                            url,
                                            res?.status
                                        );
                                    }
                                    controller.enqueue(`revalidated:${url}\n`);
                                } catch (e) {
                                    console.error(
                                        `[revalidate:page-revalidate] error: url=${url}; error=${JSON.stringify((e as Error)?.message)}`
                                    );

                                    // Check if this is an intentional revalidation error or an unexpected error
                                    if (!(e instanceof RevalidationError)) {
                                        // This is an unexpected error
                                        const errorMessage = String(e);
                                        const errorDetails: any = {};

                                        if (e && typeof e === "object" && "cause" in e && e.cause !== undefined) {
                                            errorDetails.cause = e.cause;
                                        }

                                        track("revalidate_page_error_unexpected", {
                                            url,
                                            domain,
                                            error: errorMessage,
                                            errorDetails
                                        });
                                    }

                                    controller.enqueue(
                                        `revalidate-failed:url=${url}:error=${escapeRegExp(String(e))}\n`
                                    );
                                }
                            })
                        );
                    }
                }

                // update homepage images for dashboard
                const authHeader = req.headers.get("authorization");
                if (authHeader == null) {
                    console.warn("Did not generate homepage images because no auth header present on request");
                } else if (
                    process.env.NEXT_PUBLIC_DASHBOARD_URL == null ||
                    process.env.NEXT_PUBLIC_DASHBOARD_URL === ""
                ) {
                    console.warn(
                        "Did not generate homepage images because NEXT_PUBLIC_DASHBOARD_URL is not defined in the environment"
                    );
                } else {
                    try {
                        await fetch(new URL("/api/generate-homepage-images", process.env.NEXT_PUBLIC_DASHBOARD_URL), {
                            method: "POST",
                            headers: {
                                authorization: authHeader
                            },
                            body: JSON.stringify({
                                url: `${docs.baseUrl.domain.replace(/\/$/, "")}${docs.baseUrl.basePath ?? ""}`
                            }),
                            signal: AbortSignal.timeout(600_000),
                            dispatcher: revalidationAgent
                        });
                    } catch (e) {
                        console.error(`[revalidate:homepage-image-revalidate] error: ${JSON.stringify(e)}`);
                    }
                }

                // finish reindexing before returning
                await reindexPromise;
                // finish revalidating cache endpoints before returning
                await Promise.all(cachePromises);

                const end = performance.now();
                console.log(`Reindex took ${end - start}ms`);
                controller.enqueue(`revalidate-finished:${end - start}ms\n`);
            } catch (e) {
                console.error(`[revalidate] ${JSON.stringify(e)}`);

                // Check if this is an intentional revalidation error or an unexpected error
                if (e instanceof RevalidationError) {
                    // This is an intentional "Failed to revalidate" error - track it as such
                    track("revalidate_intentional_failure", {
                        url: e.url,
                        domain,
                        status: e.status,
                        error: e.message
                    });
                } else {
                    // This is an unexpected error
                    track("revalidate_unexpected_error", {
                        domain,
                        error: String(e)
                    });
                }

                controller.enqueue(`revalidate-failed:error=${escapeRegExp(String(e))}\n`);
            } finally {
                controller.close();
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

    const isAskAiEnabled = (
        await getFaiClient({
            token: process.env.FERN_TOKEN ?? ""
        }).settings.getSettings({ domain })
    ).ask_ai_enabled;

    if (isAskAiEnabled) {
        await queueTurbopufferReindex(host, withoutStaging(domain), basePath, maxDuration);
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
