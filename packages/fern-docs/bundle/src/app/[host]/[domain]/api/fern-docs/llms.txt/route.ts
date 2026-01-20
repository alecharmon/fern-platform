import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { track } from "@fern-api/docs-server/analytics/posthog";
import { addLeadingSlash, COOKIE_FERN_TOKEN, isLikelyBrowser, slugToHref } from "@fern-api/docs-utils";
import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { CONTINUE, SKIP } from "@fern-api/fdr-sdk/traversers";
import { isNonNullish, withDefaultProtocol } from "@fern-api/ui-core-utils";
import { getAuthEdgeConfig } from "@fern-docs/edge-config";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { getMarkdownForPath, type MarkdownFilterOptions, parseSdkLanguageFilter } from "@/server/getMarkdownForPath";
import { getSectionRoot } from "@/server/getSectionRoot";
import { getLlmTxtMetadata } from "@/server/llm-txt-md";
import { parseRolesFromAuthedParam } from "@/server/parseRoles";

/**
 * This endpoint follows the https://llmstxt.org/ specification for a LLM-friendly markdown-esque page listing all the pages in the docs.
 * This page is akin to a "table of contents" page or a sitemap, and works at every level of the docs hierarchy.
 *
 * I.e.
 * - /llms.txt
 * - /docs/llms.txt
 * - /v1/llms.txt
 * - /v2/llms.txt
 * - /v1/api-reference/llms.txt
 *
 * Urls to all pages will be appended with `.md` or `.mdx` to indicate that it's a LLM-friendly markdown page.
 * Otherwise, the original urls will be used.
 *
 * Notes:
 * - API Docs do not currently have `.mdx` equivalents, so the original urls are used for those.
 * - the breadcrumb is included for all API endpoints because the endpoint title is not always unique or descriptive.
 * - hidden and noindexed nodes are not included in the list
 * - should hidden pages be included under an `## Optional` heading?
 */
export async function GET(
    req: NextRequest,
    props: { params: Promise<{ host: string; domain: string }> }
): Promise<NextResponse> {
    const { host, domain } = await props.params;

    await getAuthEdgeConfig(domain);

    const fernToken = req.headers.get("FERN_TOKEN") ?? (await cookies()).get(COOKIE_FERN_TOKEN)?.value;

    const path = slugToHref(req.nextUrl.searchParams.get("slug") ?? "");

    // Parse roles from authed query parameter
    const authedParam = req.nextUrl.searchParams.get("authed");
    const userRoles = parseRolesFromAuthedParam(authedParam);

    // Parse filter options from query parameters
    const langParam = req.nextUrl.searchParams.get("lang");
    const excludeSpecParam = req.nextUrl.searchParams.get("excludeSpec");
    const filterOptions: MarkdownFilterOptions = {
        sdkLanguage: parseSdkLanguageFilter(langParam),
        excludeSpec: excludeSpecParam === "true"
    };

    let loader;
    let root;

    try {
        loader = await createCachedDocsLoader(host, domain, fernToken);
        root = getSectionRoot(await loader.getRoot(), path);
    } catch (error) {
        console.error(`[llmsTxt:${domain}] Error loading domain or root:`, error);
        return new NextResponse("Not found", {
            status: 404,
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-store",
                "X-Robots-Tag": "noindex"
            }
        });
    }

    if (root == null) {
        console.error(`[llmsTxt:${domain}] Could not find root for path: ${path}`);
        return new NextResponse("Not found", {
            status: 404,
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-store",
                "X-Robots-Tag": "noindex"
            }
        });
    }

    const userAgent = req.headers.get("user-agent");
    const acceptHeader = req.headers.get("accept");
    const possibleBot = !isLikelyBrowser(userAgent);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const startTime = performance.now();
            let contentLength = 0;
            let rootRetrievalMs = 0;
            let markdownProcessingMs = 0;

            try {
                const { timingStats, status } = await getLlmsTxtStreaming(
                    host,
                    domain,
                    path,
                    fernToken,
                    userRoles,
                    filterOptions,
                    (chunk: string) => {
                        contentLength += chunk.length;
                        controller.enqueue(encoder.encode(chunk));
                    },
                    loader,
                    root
                );

                rootRetrievalMs = timingStats.rootRetrievalMs;
                markdownProcessingMs = timingStats.markdownProcessingMs;

                controller.close();

                // Don't log to PostHog for unauthorized requests
                if (status === "unauthorized") {
                    return;
                }

                const loadTimeMs = performance.now() - startTime;

                track("static_content_served", {
                    domain,
                    host,
                    path,
                    contentLength,
                    loadTimeMs,
                    rootRetrievalMs,
                    markdownProcessingMs,
                    possibleBot,
                    userAgent,
                    acceptHeader,
                    staticContentType: "llms.txt",
                    streaming: true
                });
            } catch (error) {
                console.error(`[llmsTxt:${domain}] Stream error:`, error);
                controller.error(error);
            }
        }
    });

    return new NextResponse(stream, {
        status: 200,
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
            "Transfer-Encoding": "chunked"
        }
    });
}

async function getLlmsTxtStreaming(
    host: string,
    domain: string,
    path: string,
    fernToken: string | undefined,
    userRoles: string[],
    filterOptions: MarkdownFilterOptions,
    onChunk: (chunk: string) => void,
    loader: Awaited<ReturnType<typeof createCachedDocsLoader>>,
    root: FernNavigation.NavigationNodeWithMetadata
): Promise<{
    timingStats: {
        rootRetrievalMs: number;
        markdownProcessingMs: number;
    };
    status: "unauthorized" | "ok";
}> {
    const rootStartTime = performance.now();
    const rootEndTime = performance.now();

    if (root.authed || root.hidden) {
        onChunk("User is not logged in");
        return {
            timingStats: {
                rootRetrievalMs: 0,
                markdownProcessingMs: 0
            },
            status: "unauthorized"
        };
    }

    const pageInfos: {
        pageId: FernNavigation.PageId;
        slug: FernNavigation.Slug;
        nodeTitle: string;
    }[] = [];

    const endpointPageInfos: {
        slug: FernNavigation.Slug;
        breadcrumb: string[];
        nodeTitle: string;
        apiDefinitionId: FernNavigation.ApiDefinitionId;
        endpointId: FernNavigation.EndpointId | undefined;
        webhookId: FernNavigation.WebhookId | undefined;
        websocketId: FernNavigation.WebSocketId | undefined;
    }[] = [];

    const landingPage = getLandingPage(root);
    const markdown =
        landingPage != null && !landingPage.authed && !landingPage.hidden
            ? await getMarkdownForPath(landingPage, loader, domain, userRoles, filterOptions)
            : undefined;

    const header = markdown?.content ?? `# ${root.title}`;
    onChunk(header + "\n\n");

    // traverse the tree in a depth-first manner to collect all the nodes that have markdown content
    // in the order that they appear in the sidebar
    FernNavigation.traverseDF(root, (node, parents) => {
        // don't include the landing page in the list
        if (landingPage != null && node.id === landingPage.id) {
            return CONTINUE;
        }

        // if the node is hidden or authed, don't include it in the list
        // TODO: include "hidden" nodes in `llms-full.txt`
        if (FernNavigation.hasMetadata(node)) {
            if (node.hidden || node.authed) {
                return SKIP;
            }
        }

        if (FernNavigation.hasMarkdown(node)) {
            // if the node is noindexed, don't include it in the list
            // TODO: include "noindexed" nodes in `llms-full.txt`
            if (node.noindex) {
                return SKIP;
            }

            const pageId = FernNavigation.getPageId(node);
            if (pageId != null) {
                pageInfos.push({
                    pageId,
                    nodeTitle: node.title,
                    slug: node.canonicalSlug ?? node.slug
                });
            }
        }

        if (FernNavigation.isApiLeaf(node)) {
            endpointPageInfos.push({
                slug: node.canonicalSlug ?? node.slug,
                nodeTitle: node.title,
                apiDefinitionId: node.apiDefinitionId,
                endpointId: node.type === "endpoint" ? node.endpointId : undefined,
                webhookId: node.type === "webhook" ? node.webhookId : undefined,
                websocketId: node.type === "webSocket" ? node.webSocketId : undefined,
                breadcrumb: parents
                    .slice(parents.findLastIndex((p) => p.type === "apiReference"))
                    .map((p) => (FernNavigation.hasMetadata(p) ? p.title : undefined))
                    .filter(isNonNullish)
            });
        }

        return CONTINUE;
    });

    const markdownStartTime = performance.now();

    if (pageInfos.length > 0) {
        onChunk("## Docs\n\n");
    }

    const BATCH_SIZE = 10;
    for (let i = 0; i < pageInfos.length; i += BATCH_SIZE) {
        const batch = pageInfos.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
            batch.map(
                async (
                    pageInfo
                ): Promise<{
                    title: string;
                    description: string | undefined;
                    href: string;
                }> => {
                    if (pageInfo.pageId != null) {
                        const page = await loader.getPage(pageInfo.pageId);
                        if (page != null) {
                            const { title, description } = getLlmTxtMetadata(page.markdown, pageInfo.nodeTitle);
                            return {
                                title,
                                description,
                                href: String(
                                    new URL(
                                        addLeadingSlash(
                                            pageInfo.slug + (pageInfo.pageId.endsWith(".mdx") ? ".mdx" : ".md")
                                        ),
                                        withDefaultProtocol(domain)
                                    )
                                )
                            };
                        }
                    }

                    return {
                        title: pageInfo.nodeTitle,
                        description: undefined,
                        href: String(new URL(slugToHref(pageInfo.slug), withDefaultProtocol(domain)))
                    };
                }
            )
        );

        for (const result of results) {
            if (result.status === "fulfilled") {
                const doc = result.value;
                const line = `- [${doc.title}](${doc.href})${doc.description != null ? `: ${doc.description}` : ""}\n`;
                onChunk(line);
            }
        }
    }

    const markdownEndTime = performance.now();

    if (endpointPageInfos.length > 0) {
        onChunk("\n## API Docs\n\n");

        const endpoints = endpointPageInfos
            .map((endpointPageInfo) => {
                return {
                    title: endpointPageInfo.nodeTitle,
                    href: String(
                        new URL(
                            endpointPageInfo.endpointId != null ||
                                endpointPageInfo.webhookId != null ||
                                endpointPageInfo.websocketId != null
                                ? addLeadingSlash(`${endpointPageInfo.slug}.mdx`)
                                : slugToHref(endpointPageInfo.slug),
                            withDefaultProtocol(domain)
                        )
                    ),
                    breadcrumb: endpointPageInfo.breadcrumb
                };
            })
            .map((endpoint) => `- ${endpoint.breadcrumb.join(" > ")} [${endpoint.title}](${endpoint.href})`);

        onChunk(endpoints.join("\n"));
    }

    return {
        timingStats: {
            rootRetrievalMs: rootEndTime - rootStartTime,
            markdownProcessingMs: markdownEndTime - markdownStartTime
        },
        status: "ok"
    };
}

function getLandingPage(
    root: FernNavigation.NavigationNodeWithMetadata
): FernNavigation.LandingPageNode | FernNavigation.NavigationNodePage | undefined {
    if (root.type === "version") {
        return root.landingPage;
    } else if (root.type === "root") {
        if (root.child.type === "productgroup" || root.child.type === "unversioned") {
            return root.child.landingPage;
        } else if (root.child.type === "versioned") {
            // return the default version's landing page
            return root.child.children.find((c) => c.default)?.landingPage;
        }
    }

    if (FernNavigation.isPage(root)) {
        return root;
    }

    return undefined;
}
