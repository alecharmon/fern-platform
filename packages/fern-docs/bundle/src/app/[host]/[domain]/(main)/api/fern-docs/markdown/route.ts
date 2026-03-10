import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { track } from "@fern-api/docs-server/analytics/posthog";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { MARKDOWN_PATTERN } from "@fern-api/docs-server/patterns";
import { COOKIE_FERN_TOKEN, isLikelyBrowser, removeLeadingSlash } from "@fern-api/docs-utils";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import {
    getMarkdownForPath,
    getPageNodeForPath,
    type MarkdownFilterOptions,
    parseSdkLanguageFilter
} from "@/server/getMarkdownForPath";
import { parseRolesFromAuthedParam } from "@/server/parseRoles";

/**
 * This endpoint returns the markdown content of any page in the docs by adding `.md` or `.mdx` to the end of any docs page.
 */

export async function GET(
    req: NextRequest,
    props: { params: Promise<{ host: string; domain: string }> }
): Promise<NextResponse> {
    const startTime = performance.now();

    if (isLocal()) {
        return new NextResponse(".md preview is not available in local preview", {
            status: 400
        });
    }

    const { host, domain } = await props.params;

    const fernToken = req.headers.get("FERN_TOKEN") ?? (await cookies()).get(COOKIE_FERN_TOKEN)?.value;

    const path = req.nextUrl.pathname;
    const slugParam = req.nextUrl.searchParams.get("slug");
    const slug = slugParam ?? path.replace(MARKDOWN_PATTERN, "");
    const cleanSlug = removeLeadingSlash(slug);

    // Parse roles from authed query parameter
    const authedParam = req.nextUrl.searchParams.get("authed");
    const userRoles = parseRolesFromAuthedParam(authedParam);

    // Parse filter options from query parameters
    const langParam = req.nextUrl.searchParams.get("lang");
    const excludeSpecParam = req.nextUrl.searchParams.get("excludeSpec");
    const filterOptions: MarkdownFilterOptions = {
        sdkLanguage: parseSdkLanguageFilter(langParam),
        excludeSpec: excludeSpecParam === "true",
        contentMode: "llm"
    };

    let loader;
    let node;

    try {
        loader = await createCachedDocsLoader(host, domain, fernToken);
        node = getPageNodeForPath(await loader.getRoot(), cleanSlug);
    } catch (error) {
        console.error(`[${domain}] Error loading domain or node:`, error);
        return new NextResponse("Not found", {
            status: 404,
            headers: {
                "Content-Type": "text/markdown; charset=utf-8",
                "Cache-Control": "no-store",
                "X-Robots-Tag": "noindex"
            }
        });
    }

    if (node == null) {
        console.error(`[${domain}] Node not found: ${path}`);
        return new NextResponse("Not found", {
            status: 404,
            headers: {
                "Content-Type": "text/markdown; charset=utf-8",
                "Cache-Control": "no-store",
                "X-Robots-Tag": "noindex"
            }
        });
    }

    // if the page is authed, return 403
    if (node.authed) {
        return new NextResponse("User is not logged in", { status: 403 });
    }

    const markdown = await getMarkdownForPath(node, loader, domain, userRoles, filterOptions);
    if (markdown == null) {
        console.error(`[${domain}] Markdown not found: ${path}`);
        return new NextResponse("Not found", {
            status: 404,
            headers: {
                "Content-Type": "text/markdown; charset=utf-8",
                "Cache-Control": "no-store",
                "X-Robots-Tag": "noindex"
            }
        });
    }

    const loadTime = performance.now() - startTime;

    const userAgent = req.headers.get("user-agent");
    const acceptHeader = req.headers.get("accept");
    const possibleBot = !isLikelyBrowser(userAgent);

    track("static_content_served", {
        domain,
        path,
        slug: cleanSlug,
        host,
        staticContentType: "markdown",
        contentLength: markdown.content.length,
        loadTimeMs: Math.round(loadTime),
        possibleBot,
        userAgent,
        acceptHeader
    });

    return new NextResponse(markdown.content, {
        status: 200,
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Robots-Tag": "noindex", // prevent search engines from indexing this page
            "Cache-Control": "no-store"
        }
    });
}

export async function OPTIONS(): Promise<NextResponse> {
    return new NextResponse(null, {
        status: 200,
        headers: {
            "X-Robots-Tag": "noindex",
            Allow: "OPTIONS, GET"
        }
    });
}
