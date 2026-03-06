import { describe, expect, it } from "vitest";

/**
 * Tests for the app-layer path prefix filter on cached 404 data.
 * This logic lives in getAllAnalytics (getWebAnalytics.ts) and filters
 * cached pages404 entries by pathPrefix to prevent cross-contamination.
 *
 * Extracted as a pure function test since the actual server action
 * requires auth, Supabase, and other infrastructure.
 */

function filterCached404sByPathPrefix(
    baseDomain: string,
    pages404: Array<{ path: string; count: number }>
): Array<{ path: string; count: number }> {
    const slashIndex = baseDomain.indexOf("/");
    const pathPrefix = slashIndex !== -1 ? baseDomain.substring(slashIndex) : null;
    return pathPrefix ? pages404.filter((p) => p.path.startsWith(pathPrefix)) : pages404;
}

describe("cached 404 path prefix filter", () => {
    const mixedPages404 = [
        { path: "/dynamo/archive/missing", count: 10 },
        { path: "/dynamo/dev/old-page", count: 8 },
        { path: "/heavyai/api/deprecated", count: 5 },
        { path: "/heavyai/docs/removed", count: 3 },
        { path: "/other/random/page", count: 1 }
    ];

    it("filters to only heavyai paths for docs.nvidia.com/heavyai", () => {
        const result = filterCached404sByPathPrefix("docs.nvidia.com/heavyai", mixedPages404);
        expect(result).toEqual([
            { path: "/heavyai/api/deprecated", count: 5 },
            { path: "/heavyai/docs/removed", count: 3 }
        ]);
    });

    it("filters to only dynamo paths for docs.dynamo.nvidia.com/dynamo", () => {
        const result = filterCached404sByPathPrefix("docs.dynamo.nvidia.com/dynamo", mixedPages404);
        expect(result).toEqual([
            { path: "/dynamo/archive/missing", count: 10 },
            { path: "/dynamo/dev/old-page", count: 8 }
        ]);
    });

    it("returns all pages when domain has no path prefix", () => {
        const result = filterCached404sByPathPrefix("api.docs.spscommerce.com", mixedPages404);
        expect(result).toEqual(mixedPages404);
    });

    it("returns empty array when no paths match the prefix", () => {
        const result = filterCached404sByPathPrefix("docs.example.com/nonexistent", mixedPages404);
        expect(result).toEqual([]);
    });

    it("handles empty pages404 array", () => {
        const result = filterCached404sByPathPrefix("docs.nvidia.com/heavyai", []);
        expect(result).toEqual([]);
    });

    it("startsWith matches longer prefixes (e.g. /heavy matches /heavyai paths)", () => {
        const result = filterCached404sByPathPrefix("docs.nvidia.com/heavy", mixedPages404);
        expect(result).toEqual([
            { path: "/heavyai/api/deprecated", count: 5 },
            { path: "/heavyai/docs/removed", count: 3 }
        ]);
    });

    it("does not match unrelated prefix", () => {
        const result = filterCached404sByPathPrefix("docs.nvidia.com/xyz", mixedPages404);
        expect(result).toEqual([]);
    });

    it("matches paths with nested segments under the prefix", () => {
        const deepPages = [
            { path: "/dynamo/a/b/c/d", count: 1 },
            { path: "/dynamo", count: 2 }
        ];
        const result = filterCached404sByPathPrefix("docs.dynamo.nvidia.com/dynamo", deepPages);
        expect(result).toEqual(deepPages);
    });
});
