import { unstable_cacheTag } from "next/cache";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { type NextRequest, NextResponse } from "next/server";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { track } from "@fern-api/docs-server/analytics/posthog";
import { COOKIE_FERN_TOKEN, addLeadingSlash, slugToHref } from "@fern-api/docs-utils";
import { isLikelyBrowser } from "@fern-api/docs-utils";
import * as FernNavigation from "@fern-api/fdr-sdk/navigation";
import { CONTINUE, SKIP } from "@fern-api/fdr-sdk/traversers";
import { isNonNullish, withDefaultProtocol } from "@fern-api/ui-core-utils";
import { getAuthEdgeConfig } from "@fern-docs/edge-config";
import { getEdgeFlags } from "@fern-docs/edge-config";

import { getMarkdownForPath } from "@/server/getMarkdownForPath";
import { getSectionRoot } from "@/server/getSectionRoot";
import { getLlmTxtMetadata } from "@/server/llm-txt-md";

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

    const [_, edgeFlags] = await Promise.all([getAuthEdgeConfig(domain), getEdgeFlags(domain)]);

    if (edgeFlags.isLlmsTxtDisabled) {
        return NextResponse.json("llms.txt is not enabled for this domain", {
            status: 404
        });
    }

    const fernToken = (await cookies()).get(COOKIE_FERN_TOKEN)?.value;

    const path = slugToHref(req.nextUrl.searchParams.get("slug") ?? "");
    const { content, timingStats } = await getLlmsTxt(host, domain, path, fernToken);

    const userAgent = req.headers.get("user-agent");
    const acceptHeader = req.headers.get("accept");
    const possibleBot = !isLikelyBrowser(userAgent);

    track("static_content_served", {
        domain,
        host,
        path,
        contentLength: content.length,
        loadTimeMs: Math.round(timingStats.loadTimeMs),
        rootRetrievalMs: Math.round(timingStats.rootRetrievalMs),
        markdownProcessingMs: Math.round(timingStats.markdownProcessingMs),
        possibleBot,
        userAgent,
        acceptHeader,
        staticContentType: "llms.txt"
    });

    return new NextResponse(content, {
        status: 200,
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "s-maxage=60"
        }
    });
}

async function getLlmsTxt(
    host: string,
    domain: string,
    path: string,
    fernToken: string | undefined
): Promise<{ content: string; timingStats: any }> {
    "use cache";

    const startTime = performance.now();
    unstable_cacheTag(domain, "getLlmsTxt");

    const loader = await createCachedDocsLoader(host, domain, fernToken);

    // Time the root retrieval and section root
    const rootStartTime = performance.now();
    const root = getSectionRoot(await loader.getRoot(), path);
    const rootEndTime = performance.now();

    if (root == null) {
        console.error(`[llmsTxt:${domain}] Could not find root`);
        notFound();
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
    const markdown = landingPage != null ? await getMarkdownForPath(landingPage, loader) : undefined;

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
    const docs = await Promise.allSettled(
        pageInfos.map(
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
    const markdownEndTime = performance.now();

    const endpoints = endpointPageInfos
        .map((endpointPageInfo) => {
            return {
                title: endpointPageInfo.nodeTitle,
                href: String(
                    new URL(
                        endpointPageInfo.endpointId != null
                            ? addLeadingSlash(`${endpointPageInfo.slug}.mdx`)
                            : slugToHref(endpointPageInfo.slug),
                        withDefaultProtocol(domain)
                    )
                ),
                breadcrumb: endpointPageInfo.breadcrumb
            };
        })
        .map((endpoint) => `- ${endpoint.breadcrumb.join(" > ")} [${endpoint.title}](${endpoint.href})`);

    const content = [
        // if there's a landing page, use the llm-friendly markdown version instead of the ${root.title}
        markdown?.content ?? `# ${root.title}`,
        docs.length > 0
            ? `## Docs\n\n${docs
                  .filter((doc) => doc.status === "fulfilled")
                  .map((doc) => doc.value)
                  .map((doc) => `- [${doc.title}](${doc.href})${doc.description != null ? `: ${doc.description}` : ""}`)
                  .join("\n")}`
            : undefined,
        endpoints.length > 0 ? `## API Docs\n\n${endpoints.join("\n")}` : undefined
    ]
        .filter(isNonNullish)
        .join("\n\n");

    const totalTime = performance.now() - startTime;

    return {
        content,
        timingStats: {
            loadTimeMs: totalTime,
            rootRetrievalMs: rootEndTime - rootStartTime,
            markdownProcessingMs: markdownEndTime - markdownStartTime
        }
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
