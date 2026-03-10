/**
 * Unit tests for the middleware path rewriting logic in proxy.ts.
 *
 * The middleware rewrites incoming request paths to internal Next.js route paths
 * using functions like `withDomain`, `splitPathname`, `withoutBasepath`, etc.
 *
 * These tests verify that:
 * - Next.js route groups like `(main)` do NOT appear in rewritten URLs
 * - The `print` route segment is correctly handled via `/_print` rewrites
 * - API routes are rewritten correctly
 * - Auth parameters are injected into the correct path positions
 * - Basepath handling works correctly
 *
 * Self-contained to avoid importing from the middleware (which has Next.js dependencies).
 * The logic tested here mirrors the implementation in proxy.ts.
 */

import { describe, expect, it } from "vitest";

// --- Mirror of splitPathname from proxy.ts ---
function splitPathname(pathname: string, splitter: string | RegExp): [basepath: string, pathname: string] {
    const index = typeof splitter === "string" ? pathname.indexOf(splitter) : pathname.search(splitter);
    if (index <= 0) {
        return ["/", pathname];
    }
    return [pathname.slice(0, index), pathname.slice(index)];
}

// --- Mirror of withDomain from proxy.ts ---
function withDomain(
    host: string,
    domain: string,
    matchedBasepath: string | undefined,
    nextBasePath: string | undefined,
    pathname: string
): string {
    const domainWithBasepath = matchedBasepath ? `${domain}${matchedBasepath}` : domain;
    const domainSegment = matchedBasepath ? encodeURIComponent(domainWithBasepath) : domain;
    const internalPath = `/${host}/${domainSegment}${pathname}`;
    return nextBasePath ? `${nextBasePath}${internalPath}` : internalPath;
}

// --- Mirror of print rewrite logic from proxy.ts ---
function rewritePrintPath(pathname: string): { matches: boolean; rewrittenSuffix?: string; basepath?: string } {
    if (!pathname.match(/\/_print(\/|$)/)) {
        return { matches: false };
    }

    const index = pathname.indexOf("/_print");
    const basepath = index <= 0 ? "/" : pathname.slice(0, index);
    const printPath = index <= 0 ? pathname : pathname.slice(index);

    const suffix = printPath === "/_print" ? "" : printPath.slice("/_print".length);
    return { matches: true, rewrittenSuffix: `/print${suffix}`, basepath };
}

// --- Mirror of API route rewrite logic from proxy.ts ---
function rewriteApiRoute(pathname: string, nextBasePath?: string): { matches: boolean; apiPath?: string } {
    if (!pathname.includes("/api/fern-docs/")) {
        return { matches: false };
    }

    if (nextBasePath) {
        return { matches: true, apiPath: pathname };
    }

    const [_basepath, apiPath] = splitPathname(pathname, "/api/fern-docs/");
    return { matches: true, apiPath };
}

// --- Mirror of auth path construction from proxy.ts ---
function buildAuthPath(requiresLogin: boolean, isLoggedIn: boolean, roles: string[], pathname: string): string {
    const requiresLoginParam = requiresLogin ? "1" : "0";
    const isLoggedInParam = isLoggedIn ? "1" : "0";
    const rolesPath = roles.join(",");
    return `/${requiresLoginParam}/${isLoggedInParam}/${rolesPath}/${encodeURIComponent(pathname)}`;
}

describe("splitPathname", () => {
    it("splits on a string splitter", () => {
        expect(splitPathname("/docs/api/fern-docs/revalidate", "/api/fern-docs/")).toEqual([
            "/docs",
            "/api/fern-docs/revalidate"
        ]);
    });

    it("returns root basepath when splitter is at start", () => {
        expect(splitPathname("/api/fern-docs/revalidate", "/api/fern-docs/")).toEqual([
            "/",
            "/api/fern-docs/revalidate"
        ]);
    });

    it("splits on a regex splitter", () => {
        expect(splitPathname("/docs/getting-started/llms.txt", /\/llms\.txt$/)).toEqual([
            "/docs/getting-started",
            "/llms.txt"
        ]);
    });

    it("returns full pathname when splitter is not found", () => {
        expect(splitPathname("/some/path", "/not-found/")).toEqual(["/", "/some/path"]);
    });

    it("handles basepath with /_print splitter", () => {
        expect(splitPathname("/v2/_print/some-page", "/_print")).toEqual(["/v2", "/_print/some-page"]);
    });

    it("handles _print at root level", () => {
        expect(splitPathname("/_print/some-page", "/_print")).toEqual(["/", "/_print/some-page"]);
    });
});

describe("withDomain", () => {
    it("constructs a basic internal path", () => {
        const result = withDomain("example.com", "example.com", undefined, undefined, "/some-page");
        expect(result).toBe("/example.com/example.com/some-page");
    });

    it("does NOT include (main) route group in the path", () => {
        const result = withDomain("example.com", "example.com", undefined, undefined, "/api/fern-docs/revalidate");
        expect(result).not.toContain("(main)");
        expect(result).toBe("/example.com/example.com/api/fern-docs/revalidate");
    });

    it("constructs path for print route without (main)", () => {
        const result = withDomain("example.com", "example.com", undefined, undefined, "/print/some-page");
        expect(result).not.toContain("(main)");
        expect(result).toBe("/example.com/example.com/print/some-page");
    });

    it("constructs path with basePath prefix", () => {
        const result = withDomain("example.com", "example.com", undefined, "/docs", "/some-page");
        expect(result).toBe("/docs/example.com/example.com/some-page");
    });

    it("encodes domain with basepath as a single segment", () => {
        const result = withDomain("example.com", "example.com", "/v2", undefined, "/some-page");
        expect(result).toBe("/example.com/example.com%2Fv2/some-page");
    });

    it("encodes domain with basepath and includes Next.js basePath", () => {
        const result = withDomain("example.com", "example.com", "/v2", "/docs", "/some-page");
        expect(result).toBe("/docs/example.com/example.com%2Fv2/some-page");
    });

    it("preserves special characters in pathname", () => {
        const result = withDomain("host.com", "domain.com", undefined, undefined, "/api/fern-docs/search/v2/chat");
        expect(result).toBe("/host.com/domain.com/api/fern-docs/search/v2/chat");
    });
});

describe("print view rewriting", () => {
    it("rewrites /_print to /print", () => {
        const result = rewritePrintPath("/_print");
        expect(result.matches).toBe(true);
        expect(result.rewrittenSuffix).toBe("/print");
    });

    it("rewrites /_print/some-page to /print/some-page", () => {
        const result = rewritePrintPath("/_print/some-page");
        expect(result.matches).toBe(true);
        expect(result.rewrittenSuffix).toBe("/print/some-page");
    });

    it("rewrites basepath/_print/page to /print/page with basepath extraction", () => {
        const result = rewritePrintPath("/v2/_print/some-page");
        expect(result.matches).toBe(true);
        expect(result.rewrittenSuffix).toBe("/print/some-page");
        expect(result.basepath).toBe("/v2");
    });

    it("does not match paths without /_print", () => {
        expect(rewritePrintPath("/some-page").matches).toBe(false);
        expect(rewritePrintPath("/print/some-page").matches).toBe(false);
        expect(rewritePrintPath("/api/fern-docs/revalidate").matches).toBe(false);
    });

    it("matches /_print/ with trailing slash", () => {
        const result = rewritePrintPath("/_print/");
        expect(result.matches).toBe(true);
        expect(result.rewrittenSuffix).toBe("/print/");
    });

    it("does not match _print in the middle of a segment name", () => {
        expect(rewritePrintPath("/my_printer").matches).toBe(false);
    });

    it("rewrites nested print paths", () => {
        const result = rewritePrintPath("/_print/api-reference/endpoints/create");
        expect(result.matches).toBe(true);
        expect(result.rewrittenSuffix).toBe("/print/api-reference/endpoints/create");
    });

    it("full rewrite path does not include (main) route group", () => {
        const printResult = rewritePrintPath("/_print/some-page");
        if (printResult.matches && printResult.rewrittenSuffix) {
            const fullPath = withDomain(
                "example.com",
                "example.com",
                undefined,
                undefined,
                printResult.rewrittenSuffix
            );
            expect(fullPath).not.toContain("(main)");
            expect(fullPath).toBe("/example.com/example.com/print/some-page");
        }
    });
});

describe("API route rewriting", () => {
    it("matches /api/fern-docs/ paths", () => {
        const result = rewriteApiRoute("/api/fern-docs/revalidate");
        expect(result.matches).toBe(true);
        expect(result.apiPath).toBe("/api/fern-docs/revalidate");
    });

    it("extracts basepath from API routes", () => {
        const result = rewriteApiRoute("/v2/api/fern-docs/revalidate");
        expect(result.matches).toBe(true);
        expect(result.apiPath).toBe("/api/fern-docs/revalidate");
    });

    it("handles search API routes", () => {
        const result = rewriteApiRoute("/api/fern-docs/search/v2/chat");
        expect(result.matches).toBe(true);
        expect(result.apiPath).toBe("/api/fern-docs/search/v2/chat");
    });

    it("handles auth API routes", () => {
        const result = rewriteApiRoute("/api/fern-docs/auth/callback");
        expect(result.matches).toBe(true);
        expect(result.apiPath).toBe("/api/fern-docs/auth/callback");
    });

    it("does not match non-API routes", () => {
        expect(rewriteApiRoute("/some-page").matches).toBe(false);
        expect(rewriteApiRoute("/getting-started").matches).toBe(false);
        expect(rewriteApiRoute("/_print/page").matches).toBe(false);
    });

    it("full rewrite path for API routes does not include (main)", () => {
        const apiResult = rewriteApiRoute("/api/fern-docs/revalidate");
        if (apiResult.matches && apiResult.apiPath) {
            const fullPath = withDomain("example.com", "example.com", undefined, undefined, apiResult.apiPath);
            expect(fullPath).not.toContain("(main)");
            expect(fullPath).toBe("/example.com/example.com/api/fern-docs/revalidate");
        }
    });

    it("uses raw pathname when nextBasePath is set", () => {
        const result = rewriteApiRoute("/api/fern-docs/revalidate", "/docs");
        expect(result.matches).toBe(true);
        expect(result.apiPath).toBe("/api/fern-docs/revalidate");
    });
});

describe("auth path construction", () => {
    it("constructs path with no auth (public docs)", () => {
        const result = buildAuthPath(false, false, ["everyone"], "/getting-started");
        expect(result).toBe("/0/0/everyone/%2Fgetting-started");
    });

    it("constructs path for logged-in user with roles", () => {
        const result = buildAuthPath(true, true, ["everyone", "admin"], "/api-reference");
        expect(result).toBe("/1/1/everyone,admin/%2Fapi-reference");
    });

    it("constructs path for site with auth but user not logged in", () => {
        const result = buildAuthPath(true, false, ["everyone"], "/getting-started");
        expect(result).toBe("/1/0/everyone/%2Fgetting-started");
    });

    it("encodes special characters in pathname", () => {
        const result = buildAuthPath(false, false, ["everyone"], "/docs/api reference");
        expect(result).toBe("/0/0/everyone/%2Fdocs%2Fapi%20reference");
    });

    it("full path with auth does not include (main)", () => {
        const authPath = buildAuthPath(false, false, ["everyone"], "/getting-started");
        const fullPath = withDomain("example.com", "example.com", undefined, undefined, authPath);
        expect(fullPath).not.toContain("(main)");
        expect(fullPath).toBe("/example.com/example.com/0/0/everyone/%2Fgetting-started");
    });
});

describe("route group transparency - (main) never appears in rewritten URLs", () => {
    const host = "example.com";
    const domain = "example.com";

    const apiRoutes = [
        "/api/fern-docs/revalidate",
        "/api/fern-docs/search/v2/chat",
        "/api/fern-docs/search/v2/key",
        "/api/fern-docs/search/v2/facet",
        "/api/fern-docs/search/v2/suggest",
        "/api/fern-docs/search/v2/reindex/algolia",
        "/api/fern-docs/search/v2/reindex/meilisearch",
        "/api/fern-docs/llms.txt",
        "/api/fern-docs/llms-full.txt",
        "/api/fern-docs/markdown",
        "/api/fern-docs/mcp",
        "/api/fern-docs/openapi",
        "/api/fern-docs/preview",
        "/api/fern-docs/og",
        "/api/fern-docs/whoami",
        "/api/fern-docs/changelog",
        "/api/fern-docs/env-local",
        "/api/fern-docs/get-jwt",
        "/api/fern-docs/invalidate",
        "/api/fern-docs/favicon.ico",
        "/api/fern-docs/get-slug-for-file",
        "/api/fern-docs/image-error",
        "/api/fern-docs/revalidate-local",
        "/api/fern-docs/revalidate-path",
        "/api/fern-docs/route-suggestions",
        "/api/fern-docs/run-page-stats-job",
        "/api/fern-docs/deployment-promoted",
        "/api/fern-docs/auth/callback",
        "/api/fern-docs/auth/logout",
        "/api/fern-docs/auth/password",
        "/api/fern-docs/auth/sso/callback",
        "/api/fern-docs/auth/sso/login",
        "/api/fern-docs/auth/verify",
        "/api/fern-docs/auth/jwt/callback",
        "/api/fern-docs/auth/api-key-injection",
        "/api/fern-docs/auth/fern-token-demo",
        "/api/fern-docs/oauth/ory/callback",
        "/api/fern-docs/oauth/webflow/callback",
        "/api/fern-docs/oauth2/callback"
    ];

    for (const route of apiRoutes) {
        it(`${route} does not contain (main) in rewritten path`, () => {
            const fullPath = withDomain(host, domain, undefined, undefined, route);
            expect(fullPath).not.toContain("(main)");
            expect(fullPath).not.toContain("(");
            expect(fullPath).not.toContain(")");
        });
    }

    it("print route does not contain (main)", () => {
        const fullPath = withDomain(host, domain, undefined, undefined, "/print/some-page");
        expect(fullPath).not.toContain("(main)");
    });

    it("explorer route does not contain (main)", () => {
        const fullPath = withDomain(host, domain, undefined, undefined, "/explorer/some-slug");
        expect(fullPath).not.toContain("(main)");
    });

    it("~login route does not contain (main)", () => {
        const fullPath = withDomain(host, domain, undefined, undefined, "/~login");
        expect(fullPath).not.toContain("(main)");
    });

    it("auth path with roles does not contain (main)", () => {
        const authPath = buildAuthPath(true, true, ["everyone", "admin"], "/getting-started");
        const fullPath = withDomain(host, domain, undefined, undefined, authPath);
        expect(fullPath).not.toContain("(main)");
    });
});

describe("special route rewrites", () => {
    it("favicon rewrite uses withDomain correctly", () => {
        const result = withDomain("example.com", "example.com", undefined, undefined, "/api/fern-docs/favicon.ico");
        expect(result).toBe("/example.com/example.com/api/fern-docs/favicon.ico");
        expect(result).not.toContain("(main)");
    });

    it("revalidate route path is correct", () => {
        const result = withDomain("example.com", "example.com", undefined, undefined, "/api/fern-docs/revalidate");
        expect(result).toBe("/example.com/example.com/api/fern-docs/revalidate");
    });

    it("revalidate-path route is correct", () => {
        const result = withDomain("example.com", "example.com", undefined, undefined, "/api/fern-docs/revalidate-path");
        expect(result).toBe("/example.com/example.com/api/fern-docs/revalidate-path");
    });

    it("~login rewrite is correct", () => {
        const result = withDomain("example.com", "example.com", undefined, undefined, "/~login");
        expect(result).toBe("/example.com/example.com/~login");
    });

    it("MCP rewrite goes to /api/fern-docs/mcp", () => {
        const result = withDomain("example.com", "example.com", undefined, undefined, "/api/fern-docs/mcp");
        expect(result).toBe("/example.com/example.com/api/fern-docs/mcp");
    });

    it("changelog route with basepath", () => {
        const result = withDomain("example.com", "example.com", "/v2", undefined, "/api/fern-docs/changelog");
        expect(result).toBe("/example.com/example.com%2Fv2/api/fern-docs/changelog");
    });
});

describe("basepath handling in rewrites", () => {
    it("correctly encodes domain with simple basepath", () => {
        const result = withDomain("example.com", "docs.example.com", "/v2", undefined, "/getting-started");
        expect(result).toBe("/example.com/docs.example.com%2Fv2/getting-started");
    });

    it("correctly encodes domain with nested basepath", () => {
        const result = withDomain("example.com", "docs.example.com", "/api/v2", undefined, "/endpoints");
        expect(result).toBe("/example.com/docs.example.com%2Fapi%2Fv2/endpoints");
    });

    it("no encoding when no basepath matched", () => {
        const result = withDomain("example.com", "docs.example.com", undefined, undefined, "/getting-started");
        expect(result).toBe("/example.com/docs.example.com/getting-started");
    });

    it("basepath + Next.js basePath both applied", () => {
        const result = withDomain("example.com", "docs.example.com", "/v2", "/app", "/getting-started");
        expect(result).toBe("/app/example.com/docs.example.com%2Fv2/getting-started");
    });

    it("API route with basepath does not include (main)", () => {
        const result = withDomain("example.com", "docs.example.com", "/v2", undefined, "/api/fern-docs/search/v2/chat");
        expect(result).not.toContain("(main)");
        expect(result).toBe("/example.com/docs.example.com%2Fv2/api/fern-docs/search/v2/chat");
    });

    it("print route with basepath does not include (main)", () => {
        const result = withDomain("example.com", "docs.example.com", "/v2", undefined, "/print/my-page");
        expect(result).not.toContain("(main)");
        expect(result).toBe("/example.com/docs.example.com%2Fv2/print/my-page");
    });
});
