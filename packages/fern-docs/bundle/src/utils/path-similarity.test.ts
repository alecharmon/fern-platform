import { describe, expect, it } from "vitest";
import { calculatePathSimilarity, findSimilarPaths } from "./path-similarity";

describe("calculatePathSimilarity", () => {
    it("should return 1 for identical paths", () => {
        expect(calculatePathSimilarity("/api/users", "/api/users")).toBe(1);
    });

    it("should return high similarity for very similar paths", () => {
        const score = calculatePathSimilarity("/api/user", "/api/users");
        expect(score).toBeGreaterThan(0.6);
    });

    it("should return moderate similarity for partially similar paths", () => {
        const score = calculatePathSimilarity("/api/v1/users", "/api/v2/users");
        expect(score).toBeGreaterThan(0.5);
        expect(score).toBeLessThan(0.9);
    });

    it("should return low similarity for very different paths", () => {
        const score = calculatePathSimilarity("/api/users", "/documentation/getting-started");
        expect(score).toBeLessThan(0.4);
    });

    it("should be case insensitive", () => {
        const score1 = calculatePathSimilarity("/API/Users", "/api/users");
        expect(score1).toBe(1);
    });

    it("should handle paths with and without leading/trailing slashes", () => {
        const score = calculatePathSimilarity("api/users/", "/api/users");
        expect(score).toBe(1);
    });

    it("should give reasonable score for substring matches", () => {
        const score = calculatePathSimilarity("/api", "/api/users");
        expect(score).toBeGreaterThan(0.3);
    });

    it("should handle empty paths", () => {
        const score = calculatePathSimilarity("", "/api/users");
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
    });
});

describe("findSimilarPaths", () => {
    const mockPaths = [
        { slug: "/api/users", title: "Users API", href: "/api/users" },
        { slug: "/api/user", title: "User API", href: "/api/user" },
        { slug: "/api/posts", title: "Posts API", href: "/api/posts" },
        { slug: "/api/authentication", title: "Authentication", href: "/api/authentication" },
        { slug: "/docs/getting-started", title: "Getting Started", href: "/docs/getting-started" },
        { slug: "/docs/quickstart", title: "Quickstart", href: "/docs/quickstart" }
    ];

    it("should return top 3 similar paths by default", () => {
        const results = findSimilarPaths("/api/userz", mockPaths);
        expect(results).toHaveLength(3);
    });

    it("should return paths sorted by similarity score", () => {
        const results = findSimilarPaths("/api/user", mockPaths);
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
        expect(results[1].score).toBeGreaterThanOrEqual(results[2].score);
    });

    it("should return exact match as top result", () => {
        const results = findSimilarPaths("/api/users", mockPaths);
        expect(results[0].slug).toBe("/api/users");
        expect(results[0].score).toBe(1);
    });

    it("should return very similar paths at the top", () => {
        const results = findSimilarPaths("/api/userz", mockPaths);
        expect(["/api/users", "/api/user"]).toContain(results[0].slug);
    });

    it("should respect custom limit", () => {
        const results = findSimilarPaths("/api/users", mockPaths, 2);
        expect(results).toHaveLength(2);
    });

    it("should handle when there are fewer paths than the limit", () => {
        const fewPaths = mockPaths.slice(0, 2);
        const results = findSimilarPaths("/api/users", fewPaths, 5);
        expect(results).toHaveLength(2);
    });

    it("should always return suggestions even for very different paths", () => {
        const results = findSimilarPaths("/completely/different/path", mockPaths);
        expect(results).toHaveLength(3);
    });

    it("should preserve all path properties in results", () => {
        const results = findSimilarPaths("/api/users", mockPaths, 1);
        expect(results[0]).toHaveProperty("slug");
        expect(results[0]).toHaveProperty("title");
        expect(results[0]).toHaveProperty("href");
        expect(results[0]).toHaveProperty("score");
    });

    it("should deduplicate paths with the same href", () => {
        const pathsWithDuplicates = [
            { slug: "/api/users", title: "Users API", href: "/api/users" },
            { slug: "/api/users-alias", title: "Users API (Alias)", href: "/api/users" },
            { slug: "/api/user", title: "User API", href: "/api/user" },
            { slug: "/api/posts", title: "Posts API", href: "/api/posts" }
        ];
        const results = findSimilarPaths("/api/users", pathsWithDuplicates, 3);
        expect(results).toHaveLength(3);
        const hrefs = results.map((r) => r.href);
        const uniqueHrefs = new Set(hrefs);
        expect(uniqueHrefs.size).toBe(3);
    });

    it("should prioritize the first occurrence when deduplicating by href", () => {
        const pathsWithDuplicates = [
            { slug: "/api/users-v1", title: "Users API v1", href: "/api/users" },
            { slug: "/api/users", title: "Users API", href: "/api/users" },
            { slug: "/api/posts", title: "Posts API", href: "/api/posts" }
        ];
        const results = findSimilarPaths("/api/users-v1", pathsWithDuplicates, 2);
        expect(results).toHaveLength(2);
        // Should include the first occurrence with the matching href
        expect(results[0].href).toBe("/api/users");
        expect(results[0].slug).toBe("/api/users-v1");
        // Second result should be different
        expect(results[1].href).not.toBe("/api/users");
    });
});

describe("elevenlabs.io/docs test cases", () => {
    const elevenLabsPaths = [
        { slug: "/overview", title: "Overview", href: "/overview" },
        { slug: "/quickstart", title: "Quickstart", href: "/quickstart" },
        { slug: "/models", title: "Models", href: "/models" },
        { slug: "/api-reference/text-to-speech", title: "Text to Speech", href: "/api-reference/text-to-speech" },
        {
            slug: "/api-reference/streaming",
            title: "Streaming",
            href: "/api-reference/streaming"
        },
        {
            slug: "/api-reference/websockets",
            title: "WebSockets",
            href: "/api-reference/websockets"
        }
    ];

    it("should suggest quickstart for /quick-start typo", () => {
        const results = findSimilarPaths("/quick-start", elevenLabsPaths);
        expect(results).toHaveLength(3);
        expect(results[0].slug).toBe("/quickstart");
    });

    it("should suggest text-to-speech for /api/text-to-speech path", () => {
        const results = findSimilarPaths("/api/text-to-speech", elevenLabsPaths);
        expect(results[0].slug).toBe("/api-reference/text-to-speech");
    });

    it("should suggest models for /model typo", () => {
        const results = findSimilarPaths("/model", elevenLabsPaths);
        expect(results[0].slug).toBe("/models");
    });

    it("should suggest websockets for /api-reference/websocket typo", () => {
        const results = findSimilarPaths("/api-reference/websocket", elevenLabsPaths);
        expect(results[0].slug).toBe("/api-reference/websockets");
    });

    it("should always return 3 suggestions even for random paths", () => {
        const results = findSimilarPaths("/random/nonexistent/path", elevenLabsPaths);
        expect(results).toHaveLength(3);
    });
});
