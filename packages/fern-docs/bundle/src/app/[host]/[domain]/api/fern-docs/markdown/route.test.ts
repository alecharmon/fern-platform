import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

describe("markdown route slug handling", () => {
    const createMockRequest = (pathname: string, searchParams: Record<string, string> = {}) => {
        const url = new URL(`https://example.com${pathname}`);
        Object.entries(searchParams).forEach(([key, value]) => {
            url.searchParams.set(key, value);
        });
        return new NextRequest(url);
    };

    it("should prefer slug from search params over pathname", () => {
        const request = createMockRequest("/api/fern-docs/markdown", { slug: "docs/quickstart" });

        const slugParam = request.nextUrl.searchParams.get("slug");
        const slug = slugParam ?? request.nextUrl.pathname.replace(/\.(md|mdx)$/, "");

        expect(slug).toBe("docs/quickstart");
    });

    it("should fallback to pathname parsing when slug param is not present", () => {
        const request = createMockRequest("/docs/quickstart.md");

        const slugParam = request.nextUrl.searchParams.get("slug");
        const slug = slugParam ?? request.nextUrl.pathname.replace(/\.(md|mdx)$/, "");

        expect(slug).toBe("/docs/quickstart");
    });

    it("should handle .mdx extension in pathname fallback", () => {
        const request = createMockRequest("/docs/quickstart.mdx");

        const slugParam = request.nextUrl.searchParams.get("slug");
        const slug = slugParam ?? request.nextUrl.pathname.replace(/\.(md|mdx)$/, "");

        expect(slug).toBe("/docs/quickstart");
    });

    it("should handle nested paths in slug param", () => {
        const request = createMockRequest("/api/fern-docs/markdown", {
            slug: "learn/sdks/overview/quickstart"
        });

        const slugParam = request.nextUrl.searchParams.get("slug");
        const slug = slugParam ?? request.nextUrl.pathname.replace(/\.(md|mdx)$/, "");

        expect(slug).toBe("learn/sdks/overview/quickstart");
    });

    it("should handle empty slug param", () => {
        const request = createMockRequest("/api/fern-docs/markdown", { slug: "" });

        const slugParam = request.nextUrl.searchParams.get("slug");
        const slug = slugParam ?? request.nextUrl.pathname.replace(/\.(md|mdx)$/, "");

        expect(slug).toBe("");
    });
});
