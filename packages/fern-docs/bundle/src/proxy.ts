import type { AuthEdgeConfig } from "@fern-api/docs-auth";
import { rewritePosthog } from "@fern-api/docs-server/analytics/rewritePosthog";
import { createGetAuthState } from "@fern-api/docs-server/auth/getAuthState";
import { createGetAuthStateEdge } from "@fern-api/docs-server/auth/getAuthStateEdge";
import { preferPreview } from "@fern-api/docs-server/auth/origin";
import { withSecureCookie } from "@fern-api/docs-server/auth/with-secure-cookie";
import { fernToken_admin, meilisearchApiKey, meilisearchOrigin } from "@fern-api/docs-server/env-variables";
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
    FERN_DOCS_PREVIEW_DOMAINS,
    HEADER_X_FERN_BASEPATH,
    HEADER_X_FERN_HOST,
    HEADER_X_FERN_REVALIDATE_AUTH,
    HEADER_X_FERN_SITE_AUTH,
    HEADER_X_FERN_TOKEN,
    HEADER_X_FORWARDED_HOST,
    isTrailingSlashEnabled,
    removeLeadingSlash,
    removeTrailingSlash
} from "@fern-api/docs-utils";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { logger } from "@fern-api/ui-core-utils/logger";
import { getAuthEdgeConfig, getDomainsWithBasepathCheck } from "@fern-docs/edge-config";
import { type MiddlewareConfig, type NextMiddleware, NextResponse } from "next/server";
import { getBasepathRoutes } from "./server/getBasepathRoutes";
import { getDomainSettings } from "./server/getDomainSettings";
import { isSelfHosted } from "./server/isSelfHosted";

/**
 * Build AuthEdgeConfig from FERN_AUTH_* env vars at runtime.
 * This is needed because getAuthEdgeConfig from @fern-docs/edge-config
 * may not work correctly in the Edge middleware bundle (build-time bundling issue).
 * The middleware has confirmed access to these env vars at runtime.
 */
function getSelfHostedAuthConfigRuntime(): AuthEdgeConfig | undefined {
    const authType = process.env.FERN_AUTH_TYPE;
    if (!authType) {
        return undefined;
    }

    const allowlist = process.env.FERN_AUTH_ALLOWLIST?.split(",").filter(Boolean);
    const denylist = process.env.FERN_AUTH_DENYLIST?.split(",").filter(Boolean);

    switch (authType) {
        case "basic_token_verification":
            return {
                type: "basic_token_verification" as const,
                secret: process.env.FERN_AUTH_SECRET ?? "",
                issuer: process.env.FERN_AUTH_ISSUER ?? "",
                redirect: process.env.FERN_AUTH_REDIRECT ?? "",
                logout: process.env.FERN_AUTH_LOGOUT,
                returnToQueryParam: process.env.FERN_AUTH_RETURN_TO_QUERY_PARAM,
                allowlist,
                denylist
            };
        case "password":
            return {
                type: "password" as const,
                password: process.env.FERN_AUTH_SECRET ?? "",
                allowlist,
                denylist
            };
        case "oauth2":
            return {
                type: "oauth2" as const,
                partner: process.env.FERN_AUTH_PARTNER ?? "",
                clientId: process.env.FERN_AUTH_CLIENT_ID ?? "",
                clientSecret: process.env.FERN_AUTH_CLIENT_SECRET ?? "",
                auth_endpoint: process.env.FERN_AUTH_ENDPOINT ?? "",
                token_endpoint: process.env.FERN_AUTH_TOKEN_ENDPOINT ?? "",
                redirectUri: process.env.FERN_AUTH_REDIRECT,
                scope: process.env.FERN_AUTH_SCOPE,
                issuer: process.env.FERN_AUTH_ISSUER,
                roles_claim: process.env.FERN_AUTH_ROLES_CLAIM,
                allowlist,
                denylist
            } as AuthEdgeConfig;
        case "sso":
            return {
                type: "sso" as const,
                partner: "workos" as const,
                organization: process.env.FERN_AUTH_ORGANIZATION ?? "",
                connection: process.env.FERN_AUTH_CONNECTION,
                provider: process.env.FERN_AUTH_PROVIDER,
                allowlist,
                denylist
            };
        default:
            logger.error(`[middleware] Unknown FERN_AUTH_TYPE: ${authType}`);
            return undefined;
    }
}

function splitPathname(pathname: string, splitter: string | RegExp): [basepath: string, pathname: string] {
    const index = typeof splitter === "string" ? pathname.indexOf(splitter) : pathname.search(splitter);
    if (index <= 0) {
        return ["/", pathname];
    }
    return [pathname.slice(0, index), pathname.slice(index)];
}

export const proxy: NextMiddleware = async (request) => {
    // For self-hosted behind the cache proxy, use the original external-facing host
    // (from X-Forwarded-Host) so that all downstream URLs (rewrites, auth redirects)
    // use the correct external port (e.g. 3000) instead of the internal Next.js port (3001).
    // Decode URI components because request.nextUrl.host can URL-encode the colon in
    // the port (e.g. "localhost%3A3000") which breaks withDefaultProtocol's localhost
    // detection and causes https:// to be used instead of http://.
    const rawHost =
        isSelfHosted() && request.headers.get("x-forwarded-host")
            ? request.headers.get("x-forwarded-host")!
            : request.nextUrl.host;
    const host = decodeURIComponent(rawHost);
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
    logger.debug("[middleware] Configuration:", {
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

    let matchedBasepath: string | undefined;
    let domainWithBasepath = domain;
    if (!isSelfHostedMode && !isLocal()) {
        const allowedDomains = await getDomainsWithBasepathCheck().catch(() => undefined);
        const shouldCheck = allowedDomains != null && (allowedDomains.includes("*") || allowedDomains.includes(domain));
        if (shouldCheck) {
            const basepaths = await getBasepathRoutes(domain).catch(() => undefined);
            if (basepaths) {
                const sorted = [...basepaths].sort((a, b) => b.length - a.length);
                for (const bp of sorted) {
                    const normalized = bp.startsWith("/") ? bp : `/${bp}`;
                    if (pathname === normalized || pathname.startsWith(`${normalized}/`)) {
                        matchedBasepath = normalized;
                        break;
                    }
                }
                domainWithBasepath = matchedBasepath ? `${domain}${matchedBasepath}` : domain;
                logger.debug("[middleware] basepath-routes matched:", {
                    domain,
                    matchedBasepath,
                    domainWithBasepath,
                    pathname
                });

                // If no basepath matched and the request is to the root, check for a default basepath
                if (!matchedBasepath && pathname === "/") {
                    const domainSettings = await getDomainSettings(domain).catch(() => undefined);
                    if (domainSettings?.defaultBasepath) {
                        const defaultBp = domainSettings.defaultBasepath.startsWith("/")
                            ? domainSettings.defaultBasepath
                            : `/${domainSettings.defaultBasepath}`;
                        // Guard against redirect loop when defaultBasepath resolves to "/"
                        const resolvedPathname = conformTrailingSlash(defaultBp);
                        if (resolvedPathname !== "/") {
                            logger.info("[middleware] redirecting to default basepath:", {
                                domain,
                                defaultBasepath: defaultBp
                            });
                            const destination = withDefaultProtocol(`${domain}${resolvedPathname}`);
                            return NextResponse.redirect(destination);
                        }
                    }
                }
            }
        }
    }

    const headers = new Headers(request.headers);
    headers.set(HEADER_X_FERN_HOST, domain);
    headers.set("x-fern-requested-path", encodeURIComponent(pathname));
    // Set basepath header for non-self-hosted basepath routes so that downstream
    // handlers (auth redirects, MCP, etc.) can include the basepath in URLs.
    if (matchedBasepath) {
        headers.set(HEADER_X_FERN_BASEPATH, matchedBasepath);
    }
    // In self-hosted mode, the cache proxy already sets x-forwarded-host to the
    // real external host (e.g. localhost:3000). Preserve it so that downstream
    // route handlers (JWT callback, etc.) can set cookies and redirects using
    // the correct origin. Only overwrite for non-self-hosted deployments where
    // the domain differs from the host (e.g. custom domains on Vercel).
    if (domain !== host && !isSelfHostedMode) {
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

        logger.debug("[middleware] rewrote", request.nextUrl.pathname, "to", destination);

        return NextResponse.rewrite(destination, {
            request: { headers: mergedHeaders }
        });
    };

    // this mutation is reversed in `useCurrentPathname` hook. if this changes, please update that hook.
    // When basePath is configured, internal routes also need the basePath prefix.
    // When a basepath-route was matched, encodeURIComponent ensures domain+basepath
    // (e.g. "example.com/repo1") stays as a single [domain] route param by encoding "/" as "%2F".
    const withDomain = (pathname: string) => {
        const domainSegment = matchedBasepath ? encodeURIComponent(domainWithBasepath) : domain;
        const internalPath = `/${host}/${domainSegment}${conformTrailingSlash(pathname)}`;
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

        // SECURITY: Reject path traversal attempts (e.g. "..%09/", "../", "..%2f")
        // Check the decoded path for any ".." segments that could escape the bucket
        if (removeBase.includes("..")) {
            return new NextResponse("Bad Request", { status: 400 });
        }

        // Extract the first path segment (should be the domain)
        const firstSegment = removeBase.split("/")[0] ?? "";

        // Validate that the first segment matches the current domain or is a known
        // Fern file-hosting domain. Custom domains (e.g. docs.getunleash.io) serve
        // pages whose file URLs contain the canonical *.docs.buildwithfern.com domain
        // because that is how files are stored in the CDN. Allow these through since
        // the underlying CDN files are publicly accessible.
        const isAssetHosting = process.env.NEXT_PUBLIC_ASSET_HOSTING === "1";
        const isFernFileDomain = FERN_DOCS_PREVIEW_DOMAINS.some(
            (suffix) => firstSegment.endsWith(`.${suffix}`) || firstSegment === suffix
        );

        if (
            !isSelfHosted() &&
            !isAssetHosting &&
            firstSegment !== domain &&
            !isFernFileDomain &&
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
                "Cache-Control": "public, max-age=3600"
            }
        });
    }

    /**
     * Rewrite /_search/* to MeiliSearch
     *
     * SECURITY: Only allow safe, read-only search endpoints. Block access to
     * sensitive MeiliSearch admin endpoints like /keys, /dumps, /snapshots,
     * /tasks, etc. that could expose API keys or allow unauthorized actions.
     *
     * Both the PATH and HTTP METHOD are validated to prevent unauthenticated
     * users from creating, updating, or deleting indexes via the proxy.
     */
    // Check for /_search/ or /_search at end of path (for the base endpoint)
    const searchMatch = pathname.match(/\/_search(\/|$)/);
    if (searchMatch) {
        const searchPath = withoutBasepath("/_search");
        // Remove "/_search" prefix and normalize by stripping leading slash for consistent regex matching
        const cleanedPath = searchPath.replace(/^\/?_search\/?/, "");
        const method = request.method;

        // SECURITY: Reject path traversal attempts (e.g. "..%09\keys", "../keys", "..%2fkeys")
        // The pathname is already decoded, so check for ".." segments that could escape to
        // sensitive MeiliSearch endpoints like /keys, /dumps, /snapshots, /tasks
        if (cleanedPath.includes("..")) {
            return new NextResponse("Bad Request", { status: 400 });
        }

        // If cleanedPath is empty, this is a request to the base /_search endpoint
        // Only allow GET for health check or info requests
        if (cleanedPath === "") {
            if (method !== "GET") {
                return new NextResponse("Method Not Allowed", { status: 405 });
            }
            const meiliUrl = `${meilisearchOrigin()}/`;
            const newHeaders = new Headers(headers);
            const meiliKey = meilisearchApiKey();
            if (meiliKey) {
                newHeaders.set("Authorization", `Bearer ${meiliKey}`);
            }
            return NextResponse.rewrite(meiliUrl, {
                request: { headers: newHeaders }
            });
        }

        // Validate both path and HTTP method for each allowed endpoint.
        // Only read-only operations and search queries are permitted:
        // - GET  indexes              - list all indexes (read-only)
        // - GET  indexes/{indexName}   - get index info (read-only)
        // - POST indexes/{indexName}/search       - single index search
        // - POST indexes/{indexName}/facet-search  - facet search
        // - POST multi-search                      - multi-index search
        const isAllowedEndpoint =
            (/^indexes\/?$/.test(cleanedPath) && method === "GET") ||
            (/^indexes\/[^/]+\/?$/.test(cleanedPath) && method === "GET") ||
            (/^indexes\/[^/]+\/search\/?$/.test(cleanedPath) && method === "POST") ||
            (/^indexes\/[^/]+\/facet-search\/?$/.test(cleanedPath) && method === "POST") ||
            (/^multi-search\/?$/.test(cleanedPath) && method === "POST");

        if (!isAllowedEndpoint) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const meiliUrl = `${meilisearchOrigin()}/${cleanedPath}`;
        const newHeaders = new Headers(headers);
        const meiliKey = meilisearchApiKey();
        if (meiliKey) {
            newHeaders.set("Authorization", `Bearer ${meiliKey}`);
        }

        return NextResponse.rewrite(meiliUrl, {
            request: { headers: newHeaders }
        });
    }

    /**
     * Rewrite revalidation routes with site-level auth header
     */
    if (pathname.endsWith("/api/fern-docs/revalidate") || pathname.endsWith("/api/fern-docs/revalidate-path")) {
        const siteAuthConfig = await getAuthEdgeConfig(domain, { bustCache: true });
        const hasSiteAuth = siteAuthConfig != null;
        const revalidateHeaders = new Headers(headers);
        revalidateHeaders.set(HEADER_X_FERN_SITE_AUTH, hasSiteAuth ? "true" : "false");

        const targetPath = pathname.endsWith("/api/fern-docs/revalidate-path")
            ? "/api/fern-docs/revalidate-path"
            : "/api/fern-docs/revalidate";
        return rewrite(withDomain(targetPath), undefined, revalidateHeaders);
    }

    /**
     * Rewrite robots.txt to domain-scoped route handler.
     * Uses withDomain() so that the [host]/[domain] route params are available.
     */
    if (pathname.endsWith("/robots.txt")) {
        withoutBasepath("/robots.txt");
        return rewrite(withDomain("/robots.txt"));
    }

    /**
     * Rewrite sitemap.xml to domain-scoped route handler at /api/fern-docs/sitemap.
     * We use /api/fern-docs/sitemap instead of /sitemap.xml because Next.js reserves
     * "sitemap.xml" as a metadata route convention at any directory level, preventing
     * our route handler from being matched.
     *
     * Don't use withoutBasepath here — it extracts everything before /sitemap.xml as
     * the basepath, which is wrong for deep paths like /nemo/api-reference/sitemap.xml
     * (would extract /nemo/api-reference instead of /nemo). The correct basepath is
     * already set by the basepath route matching above (line ~191).
     */
    if (pathname.endsWith("/sitemap.xml")) {
        return rewrite(withDomain("/api/fern-docs/sitemap"));
    }

    if (pathname.endsWith("/favicon.ico")) {
        return rewrite(withDomain("/api/fern-docs/favicon.ico"));
    }

    /**
     * Rewrite OpenAPI spec requests
     * Supports /openapi.json, /openapi.yaml, /openapi.yml, and /openapi
     */
    if (pathname.endsWith("/openapi.json")) {
        const apiId = request.nextUrl.searchParams.get("api");
        const search: Record<string, string> = { format: "json" };
        const openapiHeaders: Record<string, string> = {};
        if (apiId) {
            search.api = apiId;
            // standalone mode does not support search params, so also use headers
            openapiHeaders["x-fern-openapi-api"] = apiId;
        }
        return rewrite(withDomain("/api/fern-docs/openapi"), search, openapiHeaders);
    }
    if (pathname.endsWith("/openapi.yaml") || pathname.endsWith("/openapi.yml")) {
        const apiId = request.nextUrl.searchParams.get("api");
        const search: Record<string, string> = { format: "yaml" };
        const openapiHeaders: Record<string, string> = {};
        if (apiId) {
            search.api = apiId;
            // standalone mode does not support search params, so also use headers
            openapiHeaders["x-fern-openapi-api"] = apiId;
        }
        return rewrite(withDomain("/api/fern-docs/openapi"), search, openapiHeaders);
    }

    /**
     * Rewrite Posthog analytics ingestion
     */
    if (pathname.includes("/api/fern-docs/analytics/posthog")) {
        return rewritePosthog(request);
    }

    /**
     * Allow local remote builder API routes to pass through without rewriting.
     * These are Pages Router routes under /api/fern-docs/remote-mdx/ that handle
     * remote MDX rendering in preview/dev mode. They must be checked before the
     * general /api/fern-docs/ rewrite below.
     */
    if (pathname === "/api/fern-docs/remote-mdx/batch-serialize" || pathname === "/api/fern-docs/remote-mdx/health") {
        return NextResponse.next({ request: { headers } });
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
        logger.debug("[middleware] rewriting mcp");
        // Extract basepath so MCP route can construct correct internal URLs
        withoutBasepath("/_mcp/server");
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
                "x-fern-changelog-slug": encodeURIComponent(slug),
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
    if (pathname.match(/\/_print(\/|$)/)) {
        // Skip auth check in local development
        if (!isLocal()) {
            const providedToken = request.headers.get(HEADER_X_FERN_TOKEN) ?? request.headers.get("FERN_TOKEN");
            if (providedToken !== fernToken_admin()) {
                return new NextResponse("Unauthorized", { status: 401 });
            }
        }
        const printPath = withoutBasepath("/_print");
        const suffix = printPath === "/_print" ? "" : printPath.slice("/_print".length);
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
        logger.debug("[middleware] Self-hosted mode detected");
        if (pathname.startsWith("/_local/")) {
            const origin = process.env.NEXT_PUBLIC_FDR_ORIGIN;
            if (!origin) {
                throw new Error("NEXT_PUBLIC_FDR_ORIGIN is required for local file handling");
            }
            const absoluteUrl = new URL(pathname, origin);
            logger.info("[middleware] Redirecting local file to FDR:", absoluteUrl.toString());
            return NextResponse.redirect(absoluteUrl);
        }

        if (!process.env.FERN_AUTH_TYPE) {
            const rolesPath = encodeRoles([EVERYONE_ROLE]);
            const isLoggedInParam = encodeBool(false);
            const requiresLoginParam = encodeBool(false);
            const rewritePath = withDomain(
                `/${requiresLoginParam}/${isLoggedInParam}/${rolesPath}/${encodeURIComponent(conformTrailingSlash(pathname))}`
            );
            logger.debug("[middleware] Self-hosted routing decision:", {
                originalPathname: pathname,
                rewritePath,
                reason: "Self-hosted mode - no auth configured, using everyone role"
            });
            return rewrite(rewritePath);
        }

        logger.debug("[middleware] Self-hosted mode with auth configured, using production auth flow");

        // Debug: log which FERN_* auth env vars are available (values of secrets are redacted)
        const authEnvVars = [
            "FERN_AUTH_TYPE",
            "FERN_AUTH_SECRET",
            "FERN_AUTH_ALLOWLIST",
            "FERN_AUTH_DENYLIST",
            "FERN_AUTH_ISSUER",
            "FERN_AUTH_REDIRECT",
            "FERN_AUTH_LOGOUT",
            "FERN_AUTH_PARTNER",
            "FERN_AUTH_CLIENT_ID",
            "FERN_AUTH_CLIENT_SECRET",
            "FERN_AUTH_ENDPOINT",
            "FERN_AUTH_TOKEN_ENDPOINT",
            "FERN_AUTH_SCOPE",
            "FERN_AUTH_ROLES_CLAIM",
            "FERN_AUTH_ORGANIZATION",
            "FERN_AUTH_CONNECTION",
            "FERN_AUTH_PROVIDER",
            "JWT_SECRET_KEY"
        ] as const;
        const authEnvDebug = Object.fromEntries(
            authEnvVars.map((key) => {
                const val = process.env[key];
                const isSecret = key.includes("SECRET") || key === "JWT_SECRET_KEY";
                return [key, val == null ? "[absent]" : isSecret ? `[set, len=${val.length}]` : val];
            })
        );
        logger.debug("[middleware] auth debug - FERN_* env vars:", authEnvDebug);

        // Debug: test getAuthEdgeConfig directly from middleware to see what it returns
        try {
            const testAuthConfig = await getAuthEdgeConfig(domain);
            logger.debug("[middleware] auth debug - getAuthEdgeConfig result:", {
                domain,
                returned: testAuthConfig != null ? { type: testAuthConfig.type } : "[undefined]"
            });
        } catch (err) {
            logger.error("[middleware] auth debug - getAuthEdgeConfig threw:", String(err));
        }
    }

    // Check for revalidation auth header - allows revalidation to specify exact auth params
    // Format: "requiresLogin:true,isLoggedIn:true,token:SECRET" or "requiresLogin:false,isLoggedIn:false,token:SECRET"
    // SECURITY: The token must match FERN_TOKEN to prevent spoofing attacks
    const revalidateAuthHeader = request.headers.get(HEADER_X_FERN_REVALIDATE_AUTH);
    if (revalidateAuthHeader) {
        const params = Object.fromEntries(
            revalidateAuthHeader.split(",").map((pair) => {
                const [key, ...valueParts] = pair.split(":");
                const value = valueParts.join(":");
                return [key, value];
            })
        );

        // Validate the token before trusting the auth params
        const providedToken = params.token;
        const expectedToken = fernToken_admin();
        if (!providedToken || providedToken !== expectedToken) {
            logger.warn("[middleware] revalidation auth header rejected - invalid or missing token", {
                host,
                domain,
                pathname,
                hasToken: !!providedToken
            });
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const requiresLoginParam = encodeBool(params.requiresLogin === "true");
        const isLoggedInParam = encodeBool(params.isLoggedIn === "true");

        // Parse roles from the revalidation header if provided (pipe-delimited),
        // otherwise fall back to just EVERYONE_ROLE
        const headerRoles = params.roles ? params.roles.split("|").filter(Boolean) : [];
        const roles =
            headerRoles.length > 0
                ? [EVERYONE_ROLE, ...headerRoles.filter((r: string) => r !== EVERYONE_ROLE).sort()]
                : [EVERYONE_ROLE];
        const rolesPath = encodeRoles(roles);

        logger.debug("[middleware] revalidation auth override:", {
            host,
            domain,
            pathname,
            requiresLogin: params.requiresLogin === "true",
            isLoggedIn: params.isLoggedIn === "true",
            headerRoles,
            roles,
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
    logger.debug("[middleware] auth debug - token presence:", {
        host,
        domain,
        pathname,
        hasFernTokenCookie,
        hasFernTokenHeader,
        cookieValue: hasFernTokenCookie
            ? `[present, length=${request.cookies.get(COOKIE_FERN_TOKEN)?.value?.length}]`
            : "[absent]"
    });

    // For self-hosted with auth, build the auth config from env vars at runtime
    // and pass it directly to createGetAuthState. This avoids relying on getAuthEdgeConfig
    // from the edge-config package, which doesn't work in the Edge middleware bundle.
    let getAuthState: Awaited<ReturnType<typeof createGetAuthState>>["getAuthState"];
    if (isSelfHosted() && process.env.FERN_AUTH_TYPE) {
        const runtimeAuthConfig = getSelfHostedAuthConfigRuntime();
        logger.debug("[middleware] self-hosted runtime auth config:", {
            type: runtimeAuthConfig?.type ?? "[undefined]",
            built: runtimeAuthConfig != null
        });
        const fernToken = request.headers.get("FERN_TOKEN") ?? request.cookies.get(COOKIE_FERN_TOKEN)?.value;
        const result = await createGetAuthState(
            host,
            domain,
            fernToken,
            runtimeAuthConfig,
            undefined, // no org metadata for self-hosted
            (token) => {
                newToken = token;
            },
            nextBasePath ?? undefined
        );
        getAuthState = result.getAuthState;
    } else {
        const result = await createGetAuthStateEdge(request, (token) => {
            newToken = token;
        });
        getAuthState = result.getAuthState;
    }
    const authState = await getAuthState(pathname);

    // Log auth state for debugging
    logger.debug("[middleware] auth debug - authState:", {
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
    const rawRoles = authState.authed
        ? [EVERYONE_ROLE, ...(authState.user.roles ?? []).slice().sort()]
        : [EVERYONE_ROLE];

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
    logger.debug("[middleware] auth debug - roles decision:", {
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
    const encodedSlug = encodeURIComponent(conformTrailingSlash(pathname));
    logger.info(
        `[404 ISSUE] middleware final rewrite: domain=${domain}, domainWithBasepath=${domainWithBasepath}, matchedBasepath=${matchedBasepath}, pathname="${pathname}", encodedSlug="${encodedSlug}"`
    );
    const getResponse = () => {
        return rewrite(withDomain(`/${requiresLoginParam}/${isLoggedInParam}/${rolesPath}/${encodedSlug}`));
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
        logger.error(
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
                logger.error("[middleware] Failed to send Slack roles alert", e);
            }
        }
    } else if (weirdRoles.length > 0) {
        // Just log weird roles without alerting
        logger.warn(
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
