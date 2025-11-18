import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { track } from "@fern-api/docs-server/analytics/posthog";
import { COOKIE_FERN_TOKEN, isLikelyBrowser, slugToHref } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { CONTINUE, SKIP } from "@fern-api/fdr-sdk/traversers";
import { uniqBy } from "es-toolkit/array";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { getMarkdownForPath } from "@/server/getMarkdownForPath";
import { getSectionRoot } from "@/server/getSectionRoot";
import { parseRolesFromAuthedParam } from "@/server/parseRoles";

export const maxDuration = 800; // 13 minutes

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ host: string; domain: string }> }
): Promise<NextResponse> {
    const { host, domain } = await props.params;

    const path = slugToHref(req.nextUrl.searchParams.get("slug") ?? "");

    const fernToken = req.headers.get("FERN_TOKEN") ?? (await cookies()).get(COOKIE_FERN_TOKEN)?.value;

    // Parse roles from authed query parameter
    const authedParam = req.nextUrl.searchParams.get("authed");
    const userRoles = parseRolesFromAuthedParam(authedParam);

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
                const loader = await createCachedDocsLoader(host, domain, fernToken);

                const rootStartTime = performance.now();
                const root = getSectionRoot(await loader.getRoot(), path);
                const rootEndTime = performance.now();
                rootRetrievalMs = rootEndTime - rootStartTime;

                if (root == null) {
                    console.error(`[llmsFull:${domain}] Could not find root`);
                    controller.close();
                    return;
                }

                const nodes: FernNavigation.NavigationNodePage[] = [];

                FernNavigation.traverseDF(root, (node, parents) => {
                    if (FernNavigation.hasMetadata(node)) {
                        if (node.hidden || node.authed) {
                            return SKIP;
                        }
                    }

                    if (node.type === "version" && !node.default) {
                        return SKIP;
                    }

                    if (FernNavigation.isPage(node)) {
                        nodes.push(node);
                    }

                    return CONTINUE;
                });

                const uniqueNodes = uniqBy(nodes, (a) => FernNavigation.getPageId(a) ?? a.canonicalSlug ?? a.slug);

                // Don't log to PostHog if no accessible nodes
                if (uniqueNodes.length === 0) {
                    controller.enqueue(encoder.encode("User is not logged in"));
                    controller.close();
                    return;
                }

                const markdownStartTime = performance.now();

                for (const node of uniqueNodes) {
                    try {
                        const markdown = await getMarkdownForPath(node, loader, domain, userRoles);
                        if (markdown != null) {
                            const content = markdown.content + "\n\n";
                            contentLength += content.length;
                            controller.enqueue(encoder.encode(content));
                        }
                    } catch (error) {
                        console.error(`[llmsFull:${domain}] Error processing node:`, error);
                    }
                }

                markdownProcessingMs = performance.now() - markdownStartTime;

                controller.close();

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
                    staticContentType: "llms-full.txt",
                    streaming: true
                });
            } catch (error) {
                console.error(`[llmsFull:${domain}] Stream error:`, error);
                controller.error(error);
            }
        }
    });

    return new NextResponse(stream, {
        status: 200,
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Robots-Tag": "noindex",
            "Cache-Control": "s-maxage=60",
            "Transfer-Encoding": "chunked"
        }
    });
}
