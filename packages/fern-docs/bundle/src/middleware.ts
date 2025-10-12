import { rewritePosthog } from "@fern-api/docs-server/analytics/rewritePosthog";
import { createGetAuthStateEdge } from "@fern-api/docs-server/auth/getAuthStateEdge";
import { preferPreview } from "@fern-api/docs-server/auth/origin";
import { withSecureCookie } from "@fern-api/docs-server/auth/with-secure-cookie";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { JSON_PATTERN, MARKDOWN_PATTERN, RSS_PATTERN } from "@fern-api/docs-server/patterns";
import { withPathname } from "@fern-api/docs-server/withPathname";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import {
    COOKIE_FERN_TOKEN,
    conformTrailingSlash,
    HEADER_X_FERN_BASEPATH,
    HEADER_X_FERN_HOST,
    HEADER_X_FORWARDED_HOST,
    isTrailingSlashEnabled,
    removeLeadingSlash,
    removeTrailingSlash
} from "@fern-api/docs-utils";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { type MiddlewareConfig, type NextMiddleware, NextResponse } from "next/server";

import { isSelfHosted } from "./server/isSelfHosted";

function splitPathname(pathname: string, splitter: string | RegExp): [basepath: string, pathname: string] {
    const index = typeof splitter === "string" ? pathname.indexOf(splitter) : pathname.search(splitter);
    if (index <= 0) {
        return ["/", pathname];
    }
    return [pathname.slice(0, index), pathname.slice(index)];
}

export const middleware: NextMiddleware = async (request) => {
    const host = request.nextUrl.host;
    const domain = getDocsDomainEdge(request);

    // note: decoding the uri component here will avoid double-encoding the pathname futher
    // down the middleware chain

    let pathname: string;
    try {
        pathname = decodeURIComponent(removeTrailingSlash(request.nextUrl.pathname));
    } catch (_) {
        return new NextResponse("Bad Request: Invalid URI encoding", {
            status: 400
        });
    }

    const headers = new Headers(request.headers);
    headers.set(HEADER_X_FERN_HOST, domain);
    if (domain !== host) {
        headers.set(HEADER_X_FORWARDED_HOST, domain);
    }

    const rewrite = (
        newPathname: string,
        search?: string | URLSearchParams | Record<string, string>,
        customHeaders?: HeadersInit
    ) => {
        const mergedHeaders = customHeaders ? new Headers(customHeaders) : new Headers(headers);

        if (pathname === newPathname && !search) {
            return NextResponse.next({ request: { headers: mergedHeaders } });
        }
        const destination = withPathname(request, conformTrailingSlash(newPathname), search);

        console.log("[middleware] rewrote", request.nextUrl.pathname, "to", destination);

        return NextResponse.rewrite(destination, {
            request: { headers: mergedHeaders }
        });
    };

    // this mutation is reversed in `useCurrentPathname` hook. if this changes, please update that hook.
    const withDomain = (pathname: string) => `/${host}/${domain}${conformTrailingSlash(pathname)}`;

    const withoutBasepath = (splitter: string | RegExp) => {
        const [basepath, newPathname] = splitPathname(pathname, splitter);
        headers.set(HEADER_X_FERN_BASEPATH, basepath);
        return newPathname;
    };

    const withoutEnding = (splitter: string | RegExp) => {
        const [newPathname] = splitPathname(pathname, splitter);
        return newPathname;
    };

    /**
     * Rewrite /_files/* to file CDN
     */
    if (pathname.includes("/_files/")) {
        const filePath = pathname.replace("https:/", "https://"); // pathnames normalize urls, so we need restore the protocol //
        const removeBase = filePath.replace(/(.*)_files\//, ""); // clean all content before and including file marker
        const cdnUrl = `${getFileCDN()}/${removeBase}`;

        // preserve query parameters if they exist
        const url = new URL(cdnUrl);
        if (request.nextUrl.search) {
            url.search = request.nextUrl.search;
        }

        return NextResponse.rewrite(url.toString(), {
            headers: {
                "Cache-Control": "public, max-age=31536000"
            }
        });
    }

    /**
     * Rewrite /_search/* to MeiliSearch
     */
    if (pathname.includes("/_search/")) {
        const searchPath = withoutBasepath("/_search/");
        const cleanedPath = searchPath.replace("_search/", "");
        const meiliUrl = `${process.env.NEXT_PUBLIC_MEILISEARCH_ORIGIN ?? "http://localhost:7700"}/${cleanedPath}`;
        // Clone headers and override Authorization
        const newHeaders = new Headers(headers);
        newHeaders.set("Authorization", `Bearer ${process.env.NEXT_PUBLIC_MEILISEARCH_API_KEY ?? "fern123!"}`);

        return NextResponse.rewrite(meiliUrl, {
            request: { headers: newHeaders }
        });
    }

    /**
     * Rewrite /api/fern-docs/revalidate-all/v3 to /api/fern-docs/revalidate?regenerate=true
     */
    if (pathname.endsWith("/api/fern-docs/revalidate-all/v3")) {
        return rewrite(withDomain("/api/fern-docs/revalidate"));
    }

    /**
     * Rewrite robots.txt
     */
    if (pathname.endsWith("/robots.txt")) {
        return rewrite(withoutBasepath("/robots.txt"));
    }

    /**
     * Rewrite sitemap.xml
     */
    if (pathname.endsWith("/sitemap.xml")) {
        return rewrite(withoutBasepath("/sitemap.xml"));
    }

    if (pathname.endsWith("/favicon.ico")) {
        return rewrite(withDomain("/api/fern-docs/favicon.ico"));
    }

    /**
     * Rewrite Posthog analytics ingestion
     */
    if (pathname.includes("/api/fern-docs/analytics/posthog")) {
        return rewritePosthog(request);
    }

    /**
     * Rewrite API routes to /api/fern-docs
     */
    if (pathname.includes("/api/fern-docs/")) {
        return rewrite(withDomain(withoutBasepath("/api/fern-docs/")));
    }

    /**
     * Rewrite llms.txt
     */
    if (pathname.endsWith("/llms.txt")) {
        const slug = removeLeadingSlash(withoutEnding(/\/llms\.txt$/));
        return rewrite(withDomain("/api/fern-docs/llms.txt"), { slug });
    }

    /**
     * Rewrite mcp
     */
    if (pathname.endsWith("/_mcp/server")) {
        return rewrite(withDomain("/api/fern-docs/mcp"));
    }

    /**
     * Rewrite llms-full.txt
     */
    if (pathname.endsWith("/llms-full.txt")) {
        const slug = removeLeadingSlash(withoutEnding(/\/llms-full\.txt$/));
        return rewrite(withDomain("/api/fern-docs/llms-full.txt"), { slug });
    }

    /**
     * Rewrite markdown
     */
    if (pathname.match(MARKDOWN_PATTERN)) {
        const slug = removeLeadingSlash(withoutEnding(MARKDOWN_PATTERN));
        return rewrite(withDomain("/api/fern-docs/markdown"), { slug });
    }

    /**
     * Rewrite changelog rss and atom feeds
     */
    if (pathname.match(RSS_PATTERN)) {
        const format = pathname.match(RSS_PATTERN)?.[1] ?? "rss";
        const slug = removeLeadingSlash(withoutEnding(RSS_PATTERN));
        // standalone mode does not support search params, so we need to use headers
        return rewrite(
            withDomain("/api/fern-docs/changelog"),
            { format, slug },
            {
                "x-fern-changelog-slug": slug,
                "x-fern-changelog-format": format
            }
        );
    }

    /**
     * Rewrite changelog json feed
     */
    if (pathname.match(JSON_PATTERN)) {
        const format = pathname.match(JSON_PATTERN)?.[1] ?? "json";
        const slug = removeLeadingSlash(withoutEnding(JSON_PATTERN));
        return rewrite(withDomain("/api/fern-docs/changelog"), { format, slug });
    }

    /**
     * Content negotiation: If Accept header contains text/plain or text/markdown,
     * serve the llms.txt version instead
     */
    const acceptHeader = request.headers.get("accept");
    if (acceptHeader && (acceptHeader.includes("text/plain") || acceptHeader.includes("text/markdown"))) {
        const slug = removeLeadingSlash(pathname);
        return rewrite(withDomain("/api/fern-docs/llms.txt"), { slug });
    }

    /**
     * At this point, conform the trailing slash setting or else redirect
     */
    if (isTrailingSlashEnabled() !== request.nextUrl.pathname.endsWith("/")) {
        const destination = request.nextUrl.clone();
        destination.pathname = conformTrailingSlash(destination.pathname);
        if (String(destination) !== String(request.nextUrl)) {
            return NextResponse.redirect(destination);
        }
    }

    /**
     * Redirect .../~explorer to ?explorer=true to avoid 404s
     */
    if (pathname.endsWith("/~explorer")) {
        const newPath = conformTrailingSlash(withoutEnding("/~explorer"));
        const url = request.nextUrl.clone();
        url.pathname = newPath;
        url.searchParams.set("explorer", "true");
        return NextResponse.redirect(url);
    }

    let newToken: string | undefined;

    // ignore authentication in local preview
    if (isLocal()) {
        // serve local files directly
        if (pathname.startsWith("/_local/")) {
            const origin = process.env.NEXT_PUBLIC_FDR_ORIGIN;
            if (!origin) {
                throw new Error("NEXT_PUBLIC_FDR_ORIGIN is required for local file handling");
            }
            const absoluteUrl = new URL(pathname, origin);
            return NextResponse.redirect(absoluteUrl);
        }

        return rewrite(withDomain(`/dynamic/${encodeURIComponent(conformTrailingSlash(pathname))}`));
    }

    if (isSelfHosted()) {
        // serve local files directly
        if (pathname.startsWith("/_local/")) {
            const origin = process.env.NEXT_PUBLIC_FDR_ORIGIN;
            if (!origin) {
                throw new Error("NEXT_PUBLIC_FDR_ORIGIN is required for local file handling");
            }
            const absoluteUrl = new URL(pathname, origin);
            return NextResponse.redirect(absoluteUrl);
        }

        return rewrite(withDomain(`/static/${encodeURIComponent(conformTrailingSlash(pathname))}`));
    }

    const { getAuthState } = await createGetAuthStateEdge(request, (token) => {
        newToken = token;
    });
    const authState = await getAuthState(pathname);

    const getResponse = () => {
        if (authState.authed || request.nextUrl.searchParams.has("error")) {
            return rewrite(withDomain(`/dynamic/${encodeURIComponent(conformTrailingSlash(pathname))}`));
        }

        return rewrite(withDomain(`/static/${encodeURIComponent(conformTrailingSlash(pathname))}`));
    };

    const response = getResponse();
    if (newToken) {
        response.cookies.set(
            COOKIE_FERN_TOKEN,
            newToken,
            withSecureCookie(withDefaultProtocol(preferPreview(host, domain)))
        );
    }
    return response;
};

export const config: MiddlewareConfig = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api/fern-docs (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         */
        "/((?!.well-known|_next|_vercel|manifest.webmanifest).*)"
    ]
};

function getFileCDN() {
    return (
        (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_FILES_ORIGIN : undefined) ??
        "https://files.buildwithfern.com"
    );
}
