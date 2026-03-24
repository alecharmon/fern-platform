import { logger } from "@fern-api/ui-core-utils/logger";
import { type NextRequest, NextResponse } from "next/server";

const POSTHOG_INGEST_HOST = "us.i.posthog.com";
const POSTHOG_ASSETS_HOST = "us-assets.i.posthog.com";

/**
 * adapted from https://posthog.com/docs/advanced/proxy/nextjs-middleware
 *
 * Vercel Runtime Malformed Response Header Error workaround:
 * - Remove any non-ASCII cookies from the proxied request headers.
 * - Only forward ASCII-safe cookies to PostHog.
 */
function filterAsciiCookies(cookieHeader: string | null): string | undefined {
    if (!cookieHeader) {
        return undefined;
    }
    // Split cookies by ';', filter out any with non-ASCII chars in name or value
    return (
        cookieHeader
            .split(";")
            .map((c) => c.trim())
            .filter((c) => /^[\x20-\x7E]+$/.test(c))
            .join("; ") || undefined
    );
}

export function rewritePosthog(request: NextRequest): NextResponse {
    try {
        const url = request.nextUrl.clone();

        // More robust pathname extraction
        const pathnameParts = request.nextUrl.pathname.split("/api/fern-docs/analytics/posthog");
        const intendedPathname = pathnameParts[1] || "/";

        const hostname = intendedPathname.startsWith("/static/") ? POSTHOG_ASSETS_HOST : POSTHOG_INGEST_HOST;

        const requestHeaders = new Headers(request.headers);

        // Remove any non-ASCII cookies from the request headers
        if (requestHeaders.has("cookie")) {
            const filteredCookie = filterAsciiCookies(requestHeaders.get("cookie"));
            if (filteredCookie) {
                requestHeaders.set("cookie", filteredCookie);
            } else {
                requestHeaders.delete("cookie");
            }
        }

        requestHeaders.set("host", hostname);

        // Ensure URL is properly constructed
        url.pathname = intendedPathname;
        url.protocol = "https";
        url.hostname = hostname;
        url.port = "443";
        url.search = ""; // Clear search params to avoid issues

        // Validate URL before rewrite
        if (!url.hostname || !url.protocol) {
            throw new Error("Invalid URL constructed");
        }

        return NextResponse.rewrite(url, {
            headers: requestHeaders
        });
    } catch (error) {
        logger.error("[rewritePosthog] Error rewriting PostHog URL:", error);
        // Always return 200 even if there's an error
        return new NextResponse(JSON.stringify({ success: true }), {
            status: 200,
            headers: {
                "Content-Type": "application/json"
            }
        });
    }
}
