/**
 * Regression tests for duplicate Location header normalization.
 *
 * The Next.js standalone server can emit duplicate Location headers on redirect
 * responses.  Bun's Headers.get() joins duplicates with ", " per the Fetch spec,
 * producing malformed redirect URLs like:
 *   /reference/rest/entities/publish-entity, /reference/rest/entities/publish-entity
 *
 * normalizeLocationHeader detects the ", " separator and returns only the first
 * value.  It is a no-op for well-formed single-value headers because ", " cannot
 * appear unencoded in a valid URI.
 */
import { describe, expect, it } from "vitest";

import { normalizeLocationHeader } from "./header-utils";

describe("normalizeLocationHeader", () => {
    describe("returns null for null input", () => {
        it("passes through null", () => {
            expect(normalizeLocationHeader(null)).toBeNull();
        });
    });

    describe("passes through well-formed single-value headers", () => {
        it("relative path", () => {
            expect(normalizeLocationHeader("/reference/rest/entities/publish-entity")).toBe(
                "/reference/rest/entities/publish-entity"
            );
        });

        it("absolute URL", () => {
            expect(normalizeLocationHeader("https://example.com/docs/getting-started")).toBe(
                "https://example.com/docs/getting-started"
            );
        });

        it("root path", () => {
            expect(normalizeLocationHeader("/")).toBe("/");
        });

        it("path with query string", () => {
            expect(normalizeLocationHeader("/search?q=hello&page=1")).toBe("/search?q=hello&page=1");
        });

        it("path with fragment", () => {
            expect(normalizeLocationHeader("/docs#section-2")).toBe("/docs#section-2");
        });

        it("path with encoded characters", () => {
            expect(normalizeLocationHeader("/docs/%E4%B8%AD%E6%96%87")).toBe("/docs/%E4%B8%AD%E6%96%87");
        });
    });

    describe("normalizes duplicated Location values", () => {
        it("extracts first value from duplicated relative paths", () => {
            expect(
                normalizeLocationHeader(
                    "/reference/rest/entities/publish-entity, /reference/rest/entities/publish-entity"
                )
            ).toBe("/reference/rest/entities/publish-entity");
        });

        it("extracts first value from duplicated absolute URLs", () => {
            expect(normalizeLocationHeader("https://example.com/docs, https://example.com/docs")).toBe(
                "https://example.com/docs"
            );
        });

        it("handles more than two duplicates", () => {
            expect(normalizeLocationHeader("/path/a, /path/a, /path/a")).toBe("/path/a");
        });

        it("handles duplicates with different values (takes first)", () => {
            expect(normalizeLocationHeader("/path/a, /path/b")).toBe("/path/a");
        });
    });

    describe("does not false-positive on encoded commas in URIs", () => {
        it("preserves path with encoded comma (%2C)", () => {
            expect(normalizeLocationHeader("/path/a%2Cb")).toBe("/path/a%2Cb");
        });

        it("preserves query string containing comma without space", () => {
            expect(normalizeLocationHeader("/search?tags=a,b,c")).toBe("/search?tags=a,b,c");
        });
    });
});
