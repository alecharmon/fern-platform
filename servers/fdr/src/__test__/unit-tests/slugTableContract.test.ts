import {
    GetMarkdownEntriesResponseSchema,
    GetSlugEntriesResponseSchema,
    MarkdownEntrySchema,
    SlugEntrySchema,
    SlugsInputSchema
} from "@fern-api/fdr-sdk/orpc-client";
import { describe, expect, it } from "vitest";

describe("Slug Table Contract Schemas", () => {
    describe("SlugsInputSchema", () => {
        it("accepts domain with basepath", () => {
            const result = SlugsInputSchema.safeParse({
                domain: "docs.example.com",
                basepath: "/docs"
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.domain).toBe("docs.example.com");
                expect(result.data.basepath).toBe("/docs");
            }
        });

        it("accepts domain without basepath (defaults to empty string)", () => {
            const result = SlugsInputSchema.safeParse({ domain: "docs.example.com" });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.basepath).toBe("");
            }
        });

        it("rejects missing domain", () => {
            expect(SlugsInputSchema.safeParse({}).success).toBe(false);
        });

        it("rejects non-string domain", () => {
            expect(SlugsInputSchema.safeParse({ domain: 123 }).success).toBe(false);
        });
    });

    describe("SlugEntrySchema", () => {
        const validSlug = {
            orgId: "acme",
            domain: "docs.example.com",
            basepath: "/docs",
            slug: "getting-started",
            lastUpdated: "2025-01-01T00:00:00.000Z"
        };

        it("accepts a valid slug entry", () => {
            const result = SlugEntrySchema.safeParse(validSlug);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.slug).toBe("getting-started");
            }
        });

        it("accepts empty basepath", () => {
            expect(SlugEntrySchema.safeParse({ ...validSlug, basepath: "" }).success).toBe(true);
        });

        it("accepts empty slug (pages without a navigation entry)", () => {
            expect(SlugEntrySchema.safeParse({ ...validSlug, slug: "" }).success).toBe(true);
        });

        it("rejects missing slug", () => {
            const { slug: _, ...without } = validSlug;
            expect(SlugEntrySchema.safeParse(without).success).toBe(false);
        });

        it("rejects missing lastUpdated", () => {
            const { lastUpdated: _, ...without } = validSlug;
            expect(SlugEntrySchema.safeParse(without).success).toBe(false);
        });
    });

    describe("MarkdownEntrySchema", () => {
        const validPage = {
            orgId: "acme",
            domain: "docs.example.com",
            basepath: "/docs",
            pageId: "pages/getting-started.mdx",
            slug: "getting-started",
            hash: "abc123def456",
            lastUpdated: "2025-01-01T00:00:00.000Z"
        };

        it("accepts a valid markdown page entry", () => {
            const result = MarkdownEntrySchema.safeParse(validPage);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.pageId).toBe("pages/getting-started.mdx");
                expect(result.data.slug).toBe("getting-started");
            }
        });

        it("accepts empty basepath", () => {
            expect(MarkdownEntrySchema.safeParse({ ...validPage, basepath: "" }).success).toBe(true);
        });

        it("accepts empty slug", () => {
            expect(MarkdownEntrySchema.safeParse({ ...validPage, slug: "" }).success).toBe(true);
        });

        it("rejects missing pageId", () => {
            const { pageId: _, ...without } = validPage;
            expect(MarkdownEntrySchema.safeParse(without).success).toBe(false);
        });

        it("rejects missing hash", () => {
            const { hash: _, ...without } = validPage;
            expect(MarkdownEntrySchema.safeParse(without).success).toBe(false);
        });
    });

    describe("GetSlugEntriesResponseSchema", () => {
        it("accepts valid response", () => {
            const result = GetSlugEntriesResponseSchema.safeParse({
                entries: [
                    {
                        orgId: "acme",
                        domain: "docs.example.com",
                        basepath: "",
                        slug: "intro",
                        lastUpdated: "2025-01-01T00:00:00.000Z"
                    }
                ]
            });
            expect(result.success).toBe(true);
        });

        it("accepts empty entries array", () => {
            expect(GetSlugEntriesResponseSchema.safeParse({ entries: [] }).success).toBe(true);
        });

        it("rejects missing entries field", () => {
            expect(GetSlugEntriesResponseSchema.safeParse({}).success).toBe(false);
        });
    });

    describe("GetMarkdownEntriesResponseSchema", () => {
        it("accepts valid response", () => {
            const result = GetMarkdownEntriesResponseSchema.safeParse({
                entries: [
                    {
                        orgId: "acme",
                        domain: "docs.example.com",
                        basepath: "",
                        pageId: "pages/intro.mdx",
                        slug: "intro",
                        hash: "abc123",
                        lastUpdated: "2025-01-01T00:00:00.000Z"
                    }
                ]
            });
            expect(result.success).toBe(true);
        });

        it("accepts empty entries array", () => {
            expect(GetMarkdownEntriesResponseSchema.safeParse({ entries: [] }).success).toBe(true);
        });

        it("rejects missing entries field", () => {
            expect(GetMarkdownEntriesResponseSchema.safeParse({}).success).toBe(false);
        });
    });
});
