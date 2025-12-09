import { type NextRequest, NextResponse } from "next/server";

const POSTHOG_INGEST_HOST = "us.i.posthog.com";
const POSTHOG_ASSETS_HOST = "us-assets.i.posthog.com";

const HEADERS_TO_STRIP = [
    // CloudFront headers
    "cloudfront-forwarded-proto",
    "cloudfront-is-android-viewer",
    "cloudfront-is-desktop-viewer",
    "cloudfront-is-ios-viewer",
    "cloudfront-is-mobile-viewer",
    "cloudfront-is-smarttv-viewer",
    "cloudfront-is-tablet-viewer",
    "cloudfront-viewer-address",
    "cloudfront-viewer-asn",
    "cloudfront-viewer-city",
    "cloudfront-viewer-country",
    "cloudfront-viewer-country-name",
    "cloudfront-viewer-country-region",
    "cloudfront-viewer-country-region-name",
    "cloudfront-viewer-http-version",
    "cloudfront-viewer-latitude",
    "cloudfront-viewer-longitude",
    "cloudfront-viewer-metro-code",
    "cloudfront-viewer-postal-code",
    "cloudfront-viewer-time-zone",
    "cloudfront-viewer-tls",
    // Vercel headers
    "x-vercel-id",
    "x-vercel-ip-as-number",
    "x-vercel-ip-city",
    "x-vercel-ip-continent",
    "x-vercel-ip-country",
    "x-vercel-ip-country-region",
    "x-vercel-ip-latitude",
    "x-vercel-ip-longitude",
    "x-vercel-ip-postal-code",
    "x-vercel-ip-timezone",
    "x-vercel-ja3-digest",
    "x-vercel-ja4-digest",
    "x-vercel-proxied-for"
];

function stripHeaders(headers: Headers): Headers {
    for (const header of HEADERS_TO_STRIP) {
        headers.delete(header);
    }
    return headers;
}

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

export async function rewritePosthog(request: NextRequest): Promise<NextResponse> {
    try {
        // More robust pathname extraction
        const pathnameParts = request.nextUrl.pathname.split("/api/fern-docs/analytics/posthog");
        const intendedPathname = pathnameParts[1] || "/";

        const hostname = intendedPathname.startsWith("/static/") ? POSTHOG_ASSETS_HOST : POSTHOG_INGEST_HOST;

        const requestHeaders = new Headers(request.headers);

        // Strip CloudFront and Vercel infrastructure headers
        stripHeaders(requestHeaders);

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

        // Construct the PostHog URL
        const posthogUrl = `https://${hostname}${intendedPathname}`;

        // Fetch from PostHog directly instead of rewriting
        const posthogResponse = await fetch(posthogUrl, {
            method: request.method,
            headers: requestHeaders,
            body: request.method !== "GET" && request.method !== "HEAD" ? await request.text() : undefined
        });

        // Create response with PostHog's body and status
        const responseHeaders = new Headers(posthogResponse.headers);

        // Strip infrastructure headers from the response
        stripHeaders(responseHeaders);

        return new NextResponse(posthogResponse.body, {
            status: posthogResponse.status,
            statusText: posthogResponse.statusText,
            headers: responseHeaders
        });
    } catch (error) {
        console.error("Error proxying to PostHog:", error);
        // Always return 200 even if there's an error
        return new NextResponse(JSON.stringify({ success: true }), {
            status: 200,
            headers: {
                "Content-Type": "application/json"
            }
        });
    }
}
