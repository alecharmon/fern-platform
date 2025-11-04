import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { track } from "@fern-api/docs-server/analytics/posthog";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { MARKDOWN_PATTERN } from "@fern-api/docs-server/patterns";
import { COOKIE_FERN_TOKEN, isLikelyBrowser, removeLeadingSlash } from "@fern-api/docs-utils";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { type NextRequest, NextResponse } from "next/server";

import { getMarkdownForPath, getPageNodeForPath } from "@/server/getMarkdownForPath";

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
    const slug = path.replace(MARKDOWN_PATTERN, "");
    const cleanSlug = removeLeadingSlash(slug);

    const loader = await createCachedDocsLoader(host, domain, fernToken);
    const node = getPageNodeForPath(await loader.getRoot(), cleanSlug);

    if (node == null) {
        console.error(`[${domain}] Node not found: ${path}`);
        notFound();
    }

    // if the page is authed, return 403
    if (node.authed) {
        return new NextResponse("User is not logged in", { status: 403 });
    }

    const markdown = await getMarkdownForPath(node, loader);
    if (markdown == null) {
        console.error(`[${domain}] Markdown not found: ${path}`);
        notFound();
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
            "Content-Type": `text/${markdown.contentType}`,
            "X-Robots-Tag": "noindex", // prevent search engines from indexing this page
            "Cache-Control": "s-maxage=60" // cannot guarantee that the content won't change, so we only cache for 60 seconds
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
