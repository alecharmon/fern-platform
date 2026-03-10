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
import { uncachedLoadWithUrl } from "@fern-api/docs-server/loadWithUrl";
import {
    EVERYONE_ROLE,
    encodeBool,
    encodeRoles,
    HEADER_X_FERN_HOST,
    HEADER_X_FERN_REVALIDATE_AUTH,
    HEADER_X_FERN_SITE_AUTH,
    slugToHref,
    withoutStaging
} from "@fern-api/docs-utils";
import { type DocsV2Read, FernNavigation } from "@fern-api/fdr-sdk";
import {
    ApiDefinitionV1ToLatest,
    type EndpointId,
    type ApiDefinition as LatestApiDefinition,
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
import { buildRoleSets } from "@/utils/build-role-sets";
import { fetchAndDiscard } from "@/utils/fetch-and-discard";
import { buildRolesHeader, processRoleSets, shouldRetrySlug } from "@/utils/process-role-sets";
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

function extractPureDomain(domainKey: string): string {
    const decoded = decodeURIComponent(domainKey);
    const slashIndex = decoded.indexOf("/");
    return slashIndex === -1 ? decoded : decoded.slice(0, slashIndex);
}

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
    hasSiteAuth: boolean;
    shouldInvalidateMdxCache: boolean;
}): Promise<void> {
    const {
        host,
        domain,
        origin,
        controller,
        doReindex,
        doRegenerate,
        cdnUri,
        authHeader,
        start,
        useGetRequests,
        hasSiteAuth,
        shouldInvalidateMdxCache
    } = params;

    const pureDomain = extractPureDomain(domain);
    console.log("[revalidate] starting revalidation:", { domain, pureDomain });

    const fetchMethod = useGetRequests ? "GET" : "HEAD";
    if (useGetRequests) {
        controller.log(`using GET requests instead of HEAD\n`);
    }

    // Invalidate stale data caches FIRST, before loading fresh data from S3.
    // This breaks a circular dependency where:
    // 1. A previously non-existent site has its 404/error responses cached in the Next.js Data Cache
    //    (via fetch() in loadDocsDefinitionFromS3, unstable_cache in getDocsUrlMetadata, etc.)
    // 2. The revalidation endpoint calls loadWithUrl which hits these stale caches and fails
    // 3. Since it fails before reaching the later revalidateTag() call, the stale caches persist
    // By invalidating the domain tag upfront, we ensure loadWithUrl fetches fresh data from S3.
    // We call revalidateTag again AFTER KV writes to ensure page-level caches see the new KV data.
    revalidateTag(domain, "max");

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

    // Use uncachedLoadWithUrl to bypass any stale data caches entirely.
    // The revalidation endpoint needs the freshest data directly from S3,
    // not a potentially stale cached version (especially for newly published sites).
    const loadWithUrlPromise = uncachedLoadWithUrl(domain);

    // Revalidate the entire layout for the domain
    // This will clear the full route cache for the domain,
    // so any pages that were deleted/orphaned will be removed from the cache
    controller.log(`revalidating layout for ${domain}\n`);
    revalidatePath(`/${host}/${encodeURIComponent(domain)}`, "layout");

    const [docs, edgeFlags, metadata] = await Promise.all([
        loadWithUrlPromise,
        getEdgeFlags(pureDomain),
        getMetadataFromResponse(withoutStaging(domain), loadWithUrlPromise)
    ]);

    let reindexPromise: Promise<void> | undefined;
    if (doReindex) {
        reindexPromise = reindex(docs, host, pureDomain, maxDuration)
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
        fetchAndDiscard(`${origin}${path}`, {
            method: fetchMethod,
            headers: { [HEADER_X_FERN_HOST]: pureDomain },
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
        if (!page) {
            continue;
        }
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
            const prunedApi = createPrunedApi(api as unknown as LatestApiDefinition);
            prunedApi.forEach((value, key) => {
                keys[`api:${key}`] = value;
            });
        });

        Object.values(docs.definition.apis).forEach((api) => {
            const prunedApi = createPrunedApi(
                ApiDefinitionV1ToLatest.from(
                    api as unknown as Parameters<typeof ApiDefinitionV1ToLatest.from>[0]
                ).migrate()
            );
            prunedApi.forEach((value, key) => {
                keys[`api:${key}`] = value;
            });
        });

        keys[CACHE_KEY_FILES] = mapValues(docs.definition.filesV2, (file) => {
            if (!file) {
                throw new Error("Unexpected undefined file in filesV2");
            }
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

    // Invalidate the data cache (unstable_cache entries for root, config, etc.) AFTER KV writes,
    // so that when pages are regenerated, the fresh data is available in KV.
    // Previously, revalidateTag was called at the start of the GET handler before KV writes,
    // creating a race condition where stale data could be cached during page regeneration.
    revalidateTag(domain, "max");
    if (shouldInvalidateMdxCache) {
        revalidateTag(`${domain}:mdx`, "max");
    }
    controller.log(`cache-tags-invalidated\n`);

    // Delay to ensure KV writes and tag invalidation propagate before page regeneration reads them
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (doRegenerate) {
        const createRevalidationQueue = (
            slugs: string[],
            authParams: { requiresLogin: boolean; isLoggedIn: boolean; roles: string[][] },
            label: string
        ) => {
            const queue = new ResilientQueue<string>({
                processItem: async (slug: string, attempt: number) => {
                    const url = withDefaultProtocol(`${pureDomain}${slugToHref(slug)}`);

                    // Path order: [requiresLogin]/[isLoggedIn]/[roles]
                    const requiresLoginParam = encodeBool(authParams.requiresLogin);
                    const isLoggedInParam = encodeBool(authParams.isLoggedIn);

                    // Revalidate for each role set (invalidate ISR cache + regenerate)
                    const roleSets = authParams.roles.length > 0 ? authParams.roles : [[EVERYONE_ROLE]];
                    for (const roleSet of roleSets) {
                        const rolesParam = encodeRoles(roleSet);
                        revalidatePath(
                            `/${host}/${encodeURIComponent(domain)}/${requiresLoginParam}/${isLoggedInParam}/${rolesParam}/${encodeURIComponent(slugToHref(slug))}`,
                            "page"
                        );
                    }

                    const startTime = performance.now();

                    // Process all role sets independently. 404s are expected for
                    // role-restricted pages and are not treated as errors.
                    const result = await processRoleSets(roleSets, async (roleSet) => {
                        const rolesHeader = buildRolesHeader(roleSet);
                        return fetchAndDiscard(`${origin}${slugToHref(slug)}`, {
                            method: fetchMethod,
                            headers: {
                                [HEADER_X_FERN_HOST]: pureDomain,
                                [HEADER_X_FERN_REVALIDATE_AUTH]: `requiresLogin:${authParams.requiresLogin},isLoggedIn:${authParams.isLoggedIn}${rolesHeader},token:${fernToken_admin()}`
                            },
                            signal: AbortSignal.timeout(600_000)
                        });
                    });

                    const endTime = performance.now();

                    // Log errors for non-404 failures
                    for (const { roleSet, error } of result.errors) {
                        console.error(
                            `[revalidate:page-revalidate] error: url=${url}; attempt=${attempt}; authMode=${label}; roles=${roleSet.join(",")}; error=${JSON.stringify(error.message)}`
                        );
                        track("revalidate_page_error_res_not_ok", {
                            url,
                            domain,
                            error: error.message,
                            attempt,
                            authMode: label,
                            roles: roleSet.join(",")
                        });
                    }

                    if (!shouldRetrySlug(result)) {
                        track("revalidate_page_stats", {
                            url,
                            domain,
                            durationMs: endTime - startTime,
                            status: 200,
                            ok: true,
                            attempt,
                            authMode: label,
                            roleSetsCount: roleSets.length,
                            succeededCount: result.succeeded,
                            skippedCount: result.skipped,
                            failedCount: result.errors.length
                        });

                        controller.log(`revalidated[${label}]:${url}\n`);
                    } else {
                        // All role sets failed with non-404 errors — throw to trigger retry
                        const lastError = result.errors[result.errors.length - 1]?.error;
                        if (lastError) {
                            throw lastError;
                        }
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

        // Collect page slugs for revalidation
        const collector = FernNavigation.NodeCollector.collect(root);
        const { authedSlugs, unauthedSlugs, authedRoles } = collector.revalidationPageSlugs;

        // Collect all unique roles: merge root-level roles with page-level viewer roles
        const allRolesSet = new Set<string>(authedRoles);
        if (root?.roles != null) {
            for (const role of root.roles) {
                allRolesSet.add(role);
            }
        }
        // Build role sets for revalidation: all non-empty subset combinations of roles, each with EVERYONE
        const roleSetsForAuth = buildRoleSets(allRolesSet);

        if (roleSetsForAuth.length > 1) {
            controller.log(`roles-detected:${Array.from(allRolesSet).join(",")}\n`);
        }

        // If site has site-level auth (from middleware header), treat ALL pages as requiring auth
        // This overrides the page-level auth settings from the navigation tree
        if (hasSiteAuth) {
            controller.log(`site-level-auth-detected\n`);

            // Combine all slugs and revalidate with auth params
            const allSlugs = [...unauthedSlugs, ...authedSlugs];
            if (allSlugs.length > 0) {
                controller.log(
                    `revalidate-queued[site-auth]:urls=${allSlugs.length};roleSets=${roleSetsForAuth.length}\n`
                );

                const result = await createRevalidationQueue(
                    allSlugs,
                    { requiresLogin: true, isLoggedIn: true, roles: roleSetsForAuth },
                    "site-auth"
                );

                if (result.failed > 0) {
                    console.error(
                        `[revalidate] ${result.failed} site-auth pages failed permanently after ${3} retries`
                    );
                    track("revalidate_pages_failed_permanently", {
                        domain,
                        failedCount: result.failed,
                        totalCount: result.total,
                        authMode: "site-auth"
                    });
                }

                controller.log(
                    `revalidate-pages-finished[site-auth]:total=${result.total};` +
                        `completed=${result.completed};failed=${result.failed}\n`
                );
            }
        } else {
            // No site-level auth: use page-level auth settings (original behavior)
            // Revalidate unauthed pages first
            if (unauthedSlugs.length > 0) {
                controller.log(`revalidate-queued[unauth]:urls=${unauthedSlugs.length}\n`);

                const unauthResult = await createRevalidationQueue(
                    unauthedSlugs,
                    { requiresLogin: false, isLoggedIn: false, roles: [[EVERYONE_ROLE]] },
                    "unauth"
                );

                if (unauthResult.failed > 0) {
                    console.error(
                        `[revalidate] ${unauthResult.failed} unauth pages failed permanently after ${3} retries`
                    );
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

            // Revalidate authed pages with all role combinations
            if (authedSlugs.length > 0) {
                controller.log(
                    `revalidate-queued[auth]:urls=${authedSlugs.length};roleSets=${roleSetsForAuth.length}\n`
                );

                const authResult = await createRevalidationQueue(
                    authedSlugs,
                    { requiresLogin: true, isLoggedIn: true, roles: roleSetsForAuth },
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
    }

    if (
        authHeader != null &&
        process.env.NEXT_PUBLIC_DASHBOARD_URL != null &&
        process.env.NEXT_PUBLIC_DASHBOARD_URL !== ""
    ) {
        try {
            await fetchAndDiscard(new URL("/api/generate-homepage-images", process.env.NEXT_PUBLIC_DASHBOARD_URL), {
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

    const { host, domain: rawDomain } = await props.params;
    // Normalize: middleware encodes basepath domains as "domain.com%2Frepo1" in the URL.
    // Decoding ensures KV/cache keys match what the loader uses during page serving.
    const domain = decodeURIComponent(rawDomain);

    // Call the invalidate endpoint before any revalidation processing to clear all caches
    const invalidateUrl = `${req.nextUrl.origin}/${host}/${rawDomain}/api/fern-docs/invalidate`;
    try {
        const invalidateRes = await fetch(invalidateUrl, {
            method: "GET",
            signal: AbortSignal.timeout(30_000)
        });
        // Consume the stream to ensure invalidation completes
        await invalidateRes.text();
        if (!invalidateRes.ok) {
            console.error(
                `[revalidate] invalidate call failed with status ${invalidateRes.status} for domain ${domain}`
            );
        } else {
            console.log(`[revalidate] invalidate call succeeded for domain ${domain}`);
        }
    } catch (e) {
        console.error(`[revalidate] invalidate call failed for domain ${domain}: ${JSON.stringify(e)}`);
    }

    const shouldRegenerateParam = req.nextUrl.searchParams.get("regenerate");

    // Read site-level auth from middleware header
    const hasSiteAuth = req.headers.get(HEADER_X_FERN_SITE_AUTH) === "true";

    const fromDeploymentPromoted = req.nextUrl.searchParams.get("fromDeploymentPromoted") === "true";

    if (fromDeploymentPromoted) {
        const controller: RevalidationController = {
            log: (message: string) => console.log(`[revalidate:${domain}] ${message.trim()}`)
        };

        try {
            const metadata = await getMetadataFromResponse(withoutStaging(domain), uncachedLoadWithUrl(domain));
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
                useGetRequests,
                hasSiteAuth,
                shouldInvalidateMdxCache: shouldRegenerateParam !== "false"
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

    // Use a deferred promise so we can call waitUntil() synchronously in the
    // handler (before the response is returned) while the actual work happens
    // inside the ReadableStream's start() callback.
    let resolveRevalidation: () => void;
    const revalidationPromise = new Promise<void>((resolve) => {
        resolveRevalidation = resolve;
    });

    // waitUntil() tells the Vercel runtime to keep the serverless function alive
    // until this promise settles, even if the client disconnects or the response
    // stream is cancelled.  This is the core fix: previously, when FDR's fetch()
    // dropped the connection without consuming the stream body, the runtime could
    // terminate the function before performRevalidation() finished — leaving KV
    // writes and revalidatePath() calls incomplete.
    waitUntil(revalidationPromise);

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

                const metadata = await getMetadataFromResponse(withoutStaging(domain), uncachedLoadWithUrl(domain));
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
                    useGetRequests,
                    hasSiteAuth,
                    shouldInvalidateMdxCache: shouldRegenerateParam !== "false"
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
                resolveRevalidation();
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
        const faiBasepath = basePath && basePath !== "/" ? basePath : undefined;
        console.log("FAI reindex: basepath decision", {
            domain,
            rawBasePath: basePath,
            resolvedBasepath: faiBasepath,
            route: faiBasepath ? "basepath-aware" : "default (no basepath)"
        });
        await faiClient.settings.reindexAskAi({
            domain: withoutStaging(domain),
            basepath: faiBasepath
        });
        return ["algolia", "turbopuffer"];
    }
    return ["algolia"];
}

function createPrunedApi(api: LatestApiDefinition) {
    const apis = new Map<string, LatestApiDefinition>();
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
