import { describe, expect, it } from "vitest";
import { normalizeMarkdownForHashing } from "../../controllers/docs/v2/getDocsWriteV2Service";

describe("normalizeMarkdownForHashing", () => {
    it("trims leading and trailing whitespace", () => {
        expect(normalizeMarkdownForHashing("  hello  ")).toBe("hello");
    });

    it("collapses internal whitespace to single space", () => {
        expect(normalizeMarkdownForHashing("hello   world")).toBe("hello world");
    });

    it("normalizes newlines to single space", () => {
        expect(normalizeMarkdownForHashing("hello\n\nworld")).toBe("hello world");
    });

    it("lowercases content", () => {
        expect(normalizeMarkdownForHashing("Hello World")).toBe("hello world");
    });

    it("produces identical hashes for whitespace-only differences", () => {
        const a = normalizeMarkdownForHashing("# Hello\n\nWorld");
        const b = normalizeMarkdownForHashing("# Hello \n \n World");
        expect(a).toBe(b);
    });

    describe("copyright year normalization", () => {
        it("normalizes copyright symbol + year", () => {
            const a = normalizeMarkdownForHashing("© 2025 Acme Inc");
            const b = normalizeMarkdownForHashing("© 2026 Acme Inc");
            expect(a).toBe(b);
        });

        it("normalizes copyright word + year", () => {
            const a = normalizeMarkdownForHashing("Copyright 2025 Acme");
            const b = normalizeMarkdownForHashing("Copyright 2026 Acme");
            expect(a).toBe(b);
        });

        it("normalizes (c) + year", () => {
            const a = normalizeMarkdownForHashing("(c) 2025 Acme");
            const b = normalizeMarkdownForHashing("(c) 2026 Acme");
            expect(a).toBe(b);
        });

        it("normalizes year ranges", () => {
            const a = normalizeMarkdownForHashing("© 2020-2025 Acme");
            const b = normalizeMarkdownForHashing("© 2020-2026 Acme");
            expect(a).toBe(b);
        });

        it("is case insensitive for copyright word", () => {
            const a = normalizeMarkdownForHashing("COPYRIGHT 2025");
            const b = normalizeMarkdownForHashing("copyright 2026");
            expect(a).toBe(b);
        });
    });

    it("detects actual content changes", () => {
        const a = normalizeMarkdownForHashing("# Getting Started\n\nWelcome to the docs.");
        const b = normalizeMarkdownForHashing("# Getting Started\n\nWelcome to the updated docs.");
        expect(a).not.toBe(b);
    });

    it("handles empty string", () => {
        expect(normalizeMarkdownForHashing("")).toBe("");
    });

    it("handles whitespace-only string", () => {
        expect(normalizeMarkdownForHashing("   \n\n  ")).toBe("");
    });
});
