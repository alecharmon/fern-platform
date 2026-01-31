import { rewritePosthog } from "@fern-api/docs-server/analytics/rewritePosthog";
import { createGetAuthStateEdge } from "@fern-api/docs-server/auth/getAuthStateEdge";
import { preferPreview } from "@fern-api/docs-server/auth/origin";
import { withSecureCookie } from "@fern-api/docs-server/auth/with-secure-cookie";
import { fernToken_admin } from "@fern-api/docs-server/env-variables";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { JSON_PATTERN, MARKDOWN_PATTERN, RSS_PATTERN } from "@fern-api/docs-server/patterns";
import { withPathname } from "@fern-api/docs-server/withPathname";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import {
    COOKIE_FERN_TOKEN,
    conformTrailingSlash,
    EVERYONE_ROLE,
    encodeBool,
    encodeRoles,
    HEADER_X_FERN_BASEPATH,
    HEADER_X_FERN_HOST,
    HEADER_X_FERN_REVALIDATE_AUTH,
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

    // Early return for already-rewritten internal routes to prevent re-processing.
    // This only applies to local development where hot reloading can cause router.refresh()
    // to re-enter middleware with already-rewritten paths like /${host}/${domain}/dynamic/%2Ffoo.
    // Re-processing these would cause path corruption due to decodeURIComponent
    // turning %2F into / and then re-encoding, leading to "path explosion".
    if (isLocal() && request.nextUrl.pathname.startsWith(`/${host}/${domain}/`)) {
        return NextResponse.next();
    }

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

    // Log basePath configuration for debugging
    const nextBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
    const isSelfHostedMode = isSelfHosted();
    console.log("[middleware] Configuration:", {
        nextBasePath,
        isSelfHosted: isSelfHostedMode,
        originalPathname: request.nextUrl.pathname,
        decodedPathname: pathname,
        host,
        domain,
        note: nextBasePath
            ? `Next.js basePath is ${nextBasePath} - it's already stripped from pathname by Next.js`
            : "No basePath configured"
    });

    const headers = new Headers(request.headers);
    headers.set(HEADER_X_FERN_HOST, domain);
    headers.set("x-fern-requested-path", pathname);
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
    // When basePath is configured, internal routes also need the basePath prefix
    const withDomain = (pathname: string) => {
        const internalPath = `/${host}/${domain}${conformTrailingSlash(pathname)}`;
        return nextBasePath ? `${nextBasePath}${internalPath}` : internalPath;
    };

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

        // Extract the first path segment (should be the domain)
        const firstSegment = removeBase.split("/")[0];

        // Validate that the first segment matches the current domain exactly
        // This prevents cross-tenant file access attacks

        const isAssetHosting = process.env.NEXT_PUBLIC_ASSET_HOSTING === "1";

        if (
            !isSelfHosted() &&
            !isAssetHosting &&
            firstSegment !== domain &&
            process.env.NEXT_PUBLIC_ASSET_HOSTING !== "1"
        ) {
            return new NextResponse("Forbidden", { status: 403 });
        }

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
     *
     * SECURITY: Only allow safe search endpoints. Block access to sensitive
     * MeiliSearch admin endpoints like /keys, /dumps, /snapshots, /tasks, etc.
     * that could expose API keys or allow unauthorized administrative actions.
     */
    if (pathname.includes("/_search/")) {
        const searchPath = withoutBasepath("/_search/");
        const cleanedPath = searchPath.replace("_search/", "");

        // Only allow search-related endpoints
        // - indexes/{indexName}/search - single index search
        // - multi-search - multi-index search
        // - indexes/{indexName}/facet-search - facet search
        const isAllowedEndpoint =
            /^indexes\/[^/]+\/search\/?$/.test(cleanedPath) ||
            /^indexes\/[^/]+\/facet-search\/?$/.test(cleanedPath) ||
            /^multi-search\/?$/.test(cleanedPath);

        if (!isAllowedEndpoint) {
            return new NextResponse("Forbidden", { status: 403 });
        }

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
        // When Next.js basePath is configured, it's already stripped from the pathname,
        // so we don't need to call withoutBasepath here
        const apiPath = nextBasePath ? pathname : withoutBasepath("/api/fern-docs/");
        return rewrite(withDomain(apiPath));
    }

    /**
     * Rewrite mcp
     */
    if (pathname.endsWith("/_mcp/server")) {
        console.log("[middleware] rewriting mcp");
        return rewrite(withDomain("/api/fern-docs/mcp"));
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
     * If Accept header contains text/plain or text/markdown,
     * serve the llms.txt version instead
     */
    const acceptHeader = request.headers.get("accept");
    const shouldServeLlmsTxt =
        acceptHeader &&
        (acceptHeader.includes("text/plain") || acceptHeader.includes("text/markdown")) &&
        !pathname.endsWith("/llms.txt") &&
        !pathname.endsWith("/llms-full.txt") &&
        !pathname.match(MARKDOWN_PATTERN);

    /**
     * Rewrite llms.txt
     */
    if (
        shouldServeLlmsTxt ||
        pathname.endsWith("/llms.txt") ||
        pathname.endsWith("/llms-full.txt") ||
        pathname.match(MARKDOWN_PATTERN)
    ) {
        const { getAuthState } = await createGetAuthStateEdge(request, (token) => {
            newToken = token;
        });
        const authState = await getAuthState(pathname);

        const rolesValue = authState.authed
            ? `authed:${[...(authState.user.roles ?? ["everyone"])].sort().join(",")}`
            : "unauthed:everyone";

        if (shouldServeLlmsTxt) {
            const slug = removeLeadingSlash(pathname);
            return rewrite(withDomain("/api/fern-docs/llms.txt"), {
                slug,
                authed: rolesValue
            });
        } else if (pathname.endsWith("/llms.txt")) {
            const slug = removeLeadingSlash(withoutEnding(/\/llms\.txt$/));
            return rewrite(withDomain("/api/fern-docs/llms.txt"), {
                slug,
                authed: rolesValue
            });
        } else if (pathname.endsWith("/llms-full.txt")) {
            const slug = removeLeadingSlash(withoutEnding(/\/llms-full\.txt$/));
            return rewrite(withDomain("/api/fern-docs/llms-full.txt"), {
                slug,
                authed: rolesValue
            });
        } else {
            const slug = removeLeadingSlash(withoutEnding(MARKDOWN_PATTERN));
            return rewrite(withDomain("/api/fern-docs/markdown"), { slug, authed: rolesValue });
        }
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

    /**
     * Rewrite /~login to the login page (for password auth)
     */
    if (pathname.endsWith("/~login")) {
        return rewrite(withDomain("/~login"));
    }

    /**
     * Print view used by the PDF generator.
     * Must bypass dynamic/static docs routing so `/_print` doesn't get treated as a docs slug.
     */
    if (pathname === "/_print" || pathname.startsWith("/_print/")) {
        // Skip auth check in local development
        if (!isLocal()) {
            const providedToken = request.headers.get("FERN_TOKEN");
            if (providedToken !== fernToken_admin()) {
                return new NextResponse("Unauthorized", { status: 401 });
            }
        }
        const suffix = pathname === "/_print" ? "" : pathname.slice("/_print".length);
        return rewrite(withDomain(`/print${suffix}`));
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

        // Local mode: inject a dynamic role to prevent caching
        // This ensures pages are always fresh during local development
        const localTestingRole = `fern-local-testing-${Math.random().toString(36).substring(2, 15)}`;
        const rolesPath = encodeRoles([EVERYONE_ROLE, localTestingRole]);
        // In local mode, assume logged in and no auth required (for development convenience)
        const isLoggedInParam = encodeBool(true);
        const requiresLoginParam = encodeBool(false);
        // Path order: [requiresLogin]/[isLoggedIn]/[roles]
        return rewrite(
            withDomain(
                `/${requiresLoginParam}/${isLoggedInParam}/${rolesPath}/${encodeURIComponent(conformTrailingSlash(pathname))}`
            )
        );
    }

    if (isSelfHosted()) {
        console.log("[middleware] Self-hosted mode detected");
        // serve local files directly
        if (pathname.startsWith("/_local/")) {
            const origin = process.env.NEXT_PUBLIC_FDR_ORIGIN;
            if (!origin) {
                throw new Error("NEXT_PUBLIC_FDR_ORIGIN is required for local file handling");
            }
            const absoluteUrl = new URL(pathname, origin);
            console.log("[middleware] Redirecting local file to FDR:", absoluteUrl.toString());
            return NextResponse.redirect(absoluteUrl);
        }

        // Self-hosted mode: use "everyone" role for static rendering
        // IMPORTANT: Self-hosted deployments currently do not support authentication.
        // Auth/roles/password protection is bypassed in self-hosted mode.
        // If auth support is needed for self-hosted deployments in the future,
        // this section will need to be updated to check for auth configuration
        // and handle it appropriately (similar to the production code path below).
        const rolesPath = encodeRoles([EVERYONE_ROLE]);
        const isLoggedInParam = encodeBool(false);
        const requiresLoginParam = encodeBool(false);
        // Path order: [requiresLogin]/[isLoggedIn]/[roles]
        const rewritePath = withDomain(
            `/${requiresLoginParam}/${isLoggedInParam}/${rolesPath}/${encodeURIComponent(conformTrailingSlash(pathname))}`
        );
        console.log("[middleware] Self-hosted routing decision:", {
            originalPathname: pathname,
            rewritePath,
            reason: "Self-hosted mode - using roles-based route with everyone"
        });
        return rewrite(rewritePath);
    }

    // Check for revalidation auth header - allows revalidation to specify exact auth params
    // Format: "requiresLogin:true,isLoggedIn:true" or "requiresLogin:false,isLoggedIn:false"
    const revalidateAuthHeader = request.headers.get(HEADER_X_FERN_REVALIDATE_AUTH);
    if (revalidateAuthHeader) {
        const params = Object.fromEntries(
            revalidateAuthHeader.split(",").map((pair) => {
                const [key, value] = pair.split(":");
                return [key, value === "true"];
            })
        );
        const requiresLoginParam = encodeBool(params.requiresLogin ?? false);
        const isLoggedInParam = encodeBool(params.isLoggedIn ?? false);
        const rolesPath = encodeRoles([EVERYONE_ROLE]);

        console.log("[middleware] revalidation auth override:", {
            host,
            domain,
            pathname,
            requiresLogin: params.requiresLogin,
            isLoggedIn: params.isLoggedIn,
            rolesPath
        });

        return rewrite(
            withDomain(
                `/${requiresLoginParam}/${isLoggedInParam}/${rolesPath}/${encodeURIComponent(conformTrailingSlash(pathname))}`
            )
        );
    }

    // Log cookie/header presence for debugging auth issues
    const hasFernTokenCookie = !!request.cookies.get(COOKIE_FERN_TOKEN);
    const hasFernTokenHeader = !!request.headers.get("FERN_TOKEN");
    console.log("[middleware] auth debug - token presence:", {
        host,
        domain,
        pathname,
        hasFernTokenCookie,
        hasFernTokenHeader,
        cookieValue: hasFernTokenCookie
            ? `[present, length=${request.cookies.get(COOKIE_FERN_TOKEN)?.value?.length}]`
            : "[absent]"
    });

    const { getAuthState } = await createGetAuthStateEdge(request, (token) => {
        newToken = token;
    });
    const authState = await getAuthState(pathname);

    // Log auth state for debugging
    console.log("[middleware] auth debug - authState:", {
        host,
        domain,
        pathname,
        authed: authState.authed,
        ok: authState.ok,
        partner: authState.partner,
        roles: authState.authed ? authState.user.roles : undefined,
        hasAuthorizationUrl: !authState.authed ? !!authState.authorizationUrl : undefined
    });

    // Determine roles based on auth state
    // If authenticated: use user's roles + "everyone"
    // If not authenticated: use only "everyone"
    const rawRoles = authState.authed ? [EVERYONE_ROLE, ...(authState.user.roles ?? [])] : [EVERYONE_ROLE];

    // Validate roles and filter out invalid ones (containing commas or empty)
    // This also sends Slack alerts for invalid roles if DOCS_ROLES_ALERT_WEBHOOK_URL is configured
    const { safeRoles } = await validateAndFilterRoles(rawRoles, { host, domain, pathname });

    // Ensure we always have at least the "everyone" role
    const roles = safeRoles.length > 0 ? safeRoles : [EVERYONE_ROLE];

    const rolesPath = encodeRoles(roles);

    // Determine isLoggedIn and requiresLogin from auth state
    // isLoggedIn: true if user is authenticated
    // requiresLogin: true if the site has auth configured (authorizationUrl exists when not logged in, or user is logged in)
    const isLoggedIn = authState.authed;
    const requiresLogin = authState.authed || (!authState.authed && authState.authorizationUrl != null);
    const isLoggedInParam = encodeBool(isLoggedIn);
    const requiresLoginParam = encodeBool(requiresLogin);

    // Log final roles decision
    console.log("[middleware] auth debug - roles decision:", {
        host,
        domain,
        pathname,
        rawRoles,
        safeRoles,
        finalRoles: roles,
        rolesPath,
        isLoggedIn,
        requiresLogin
    });

    // Path order: [requiresLogin]/[isLoggedIn]/[roles]
    const getResponse = () => {
        return rewrite(
            withDomain(
                `/${requiresLoginParam}/${isLoggedInParam}/${rolesPath}/${encodeURIComponent(conformTrailingSlash(pathname))}`
            )
        );
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

/**
 * Validates roles and returns safe roles (without commas or empty strings).
 * Logs warnings and optionally sends Slack alerts for invalid roles.
 */
async function validateAndFilterRoles(
    roles: string[],
    context: { host: string; domain: string; pathname: string }
): Promise<{ safeRoles: string[]; invalidRoles: string[]; weirdRoles: string[] }> {
    // Invalid roles: contain commas (would break decoding) or are empty
    const invalidRoles = roles.filter((role) => role.includes(",") || role.length === 0);

    // Weird roles: contain unusual characters but are still safe to encode
    // These are logged for visibility but not filtered out
    const weirdRoles = roles.filter((role) => !invalidRoles.includes(role) && !/^[A-Za-z0-9:_-]+$/.test(role));

    // Filter out invalid roles
    const safeRoles = roles.filter((role) => !invalidRoles.includes(role));

    // Log and alert if there are invalid roles
    if (invalidRoles.length > 0) {
        console.error(
            `[middleware] Invalid roles detected for ${context.host}/${context.domain}${context.pathname}: ` +
                `invalid=${JSON.stringify(invalidRoles)}, all=${JSON.stringify(roles)}`
        );

        // Send Slack alert if webhook is configured
        const webhookUrl = process.env.SLACK_WEBHOOK_URL_DOCS_INCIDENTS;
        if (webhookUrl) {
            try {
                await fetch(webhookUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        text:
                            `*Docs roles guardrail triggered*\n` +
                            `Host: \`${context.host}\`\n` +
                            `Domain: \`${context.domain}\`\n` +
                            `Path: \`${context.pathname}\`\n` +
                            `All roles: \`${JSON.stringify(roles)}\`\n` +
                            `Invalid roles (commas/empty): \`${JSON.stringify(invalidRoles)}\`` +
                            (weirdRoles.length > 0
                                ? `\nWeird-but-allowed roles: \`${JSON.stringify(weirdRoles)}\``
                                : "")
                    })
                });
            } catch (e) {
                console.error("[middleware] Failed to send Slack roles alert", e);
            }
        }
    } else if (weirdRoles.length > 0) {
        // Just log weird roles without alerting
        console.warn(
            `[middleware] Unusual role characters detected for ${context.host}/${context.domain}${context.pathname}: ` +
                `weird=${JSON.stringify(weirdRoles)}`
        );
    }

    return { safeRoles, invalidRoles, weirdRoles };
}

export const config: MiddlewareConfig = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - .well-known
         * - _next (static files, image optimization)
         * - _vercel
         * - manifest.webmanifest
         *
         * Note: When basePath is configured (e.g., NEXT_PUBLIC_BASE_PATH="/docs"),
         * the root path "/" needs special handling. We include it here unconditionally
         * since it doesn't affect non-basePath deployments.
         */
        "/",
        "/((?!.well-known|_next|_vercel|manifest.webmanifest).*)"
    ]
};

function getFileCDN() {
    return (
        (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_FILES_ORIGIN : undefined) ??
        "https://files.buildwithfern.com"
    );
}
