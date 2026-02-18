/**
 * Unit tests for _files endpoint security logic.
 * Tests the path traversal protection that prevents requests like
 * /_files/..%09/domain/ from escaping the MinIO bucket.
 *
 * Self-contained to avoid importing from the middleware (which has Next.js dependencies).
 * The logic tested here mirrors the implementation in middleware.ts.
 */

/**
 * Mirrors the _files path validation logic from middleware.ts:
 * 1. Extract the path after "_files/"
 * 2. Reject if the decoded path contains ".."
 * 3. Build the CDN URL
 */
function validateFilesPath(pathname: string): { allowed: boolean; removeBase?: string } {
    if (!pathname.includes("/_files/")) {
        return { allowed: false };
    }

    const filePath = pathname.replace("https:/", "https://");
    const removeBase = filePath.replace(/(.*)_files\//, "");

    if (removeBase.includes("..")) {
        return { allowed: false };
    }

    return { allowed: true, removeBase };
}

describe("_files path traversal protection", () => {
    describe("rejects path traversal attempts", () => {
        it("rejects ..%09/ (tab-encoded traversal)", () => {
            // %09 is decoded to tab by the URL parser before reaching middleware
            // but the ".." prefix is what matters
            const result = validateFilesPath("/_files/..%09/domain/");
            expect(result.allowed).toBe(false);
        });

        it("rejects ../ (basic traversal)", () => {
            const result = validateFilesPath("/_files/../etc/passwd");
            expect(result.allowed).toBe(false);
        });

        it("rejects ..%2f (encoded slash traversal)", () => {
            const result = validateFilesPath("/_files/..%2f..%2f");
            expect(result.allowed).toBe(false);
        });

        it("rejects nested traversal", () => {
            const result = validateFilesPath("/_files/foo/../../bar");
            expect(result.allowed).toBe(false);
        });

        it("rejects double-dot at end of path", () => {
            const result = validateFilesPath("/_files/foo/..");
            expect(result.allowed).toBe(false);
        });

        it("rejects double-dot in middle of segment", () => {
            const result = validateFilesPath("/_files/foo/../bar/baz");
            expect(result.allowed).toBe(false);
        });

        it("rejects traversal with query params", () => {
            const result = validateFilesPath("/_files/../secret?key=val");
            expect(result.allowed).toBe(false);
        });
    });

    describe("allows valid file paths", () => {
        it("allows simple file path", () => {
            const result = validateFilesPath("/_files/domain.com/file.js");
            expect(result.allowed).toBe(true);
            expect(result.removeBase).toBe("domain.com/file.js");
        });

        it("allows nested file path", () => {
            const result = validateFilesPath("/_files/domain.com/assets/css/style.css");
            expect(result.allowed).toBe(true);
            expect(result.removeBase).toBe("domain.com/assets/css/style.css");
        });

        it("allows path with hyphens and underscores", () => {
            const result = validateFilesPath("/_files/my-domain.com/my_file-name.txt");
            expect(result.allowed).toBe(true);
            expect(result.removeBase).toBe("my-domain.com/my_file-name.txt");
        });

        it("allows path with single dot (file extension)", () => {
            const result = validateFilesPath("/_files/domain.com/file.tar.gz");
            expect(result.allowed).toBe(true);
            expect(result.removeBase).toBe("domain.com/file.tar.gz");
        });

        it("allows https:// prefixed paths (middleware URL normalization)", () => {
            const result = validateFilesPath("/_files/https:/domain.com/file.js");
            expect(result.allowed).toBe(true);
            expect(result.removeBase).toBe("https://domain.com/file.js");
        });
    });

    describe("does not match non-_files paths", () => {
        it("rejects paths without _files", () => {
            const result = validateFilesPath("/some/other/path");
            expect(result.allowed).toBe(false);
        });

        it("rejects _search paths", () => {
            const result = validateFilesPath("/_search/indexes/docs/search");
            expect(result.allowed).toBe(false);
        });

        it("rejects _local paths", () => {
            const result = validateFilesPath("/_local/some-file");
            expect(result.allowed).toBe(false);
        });
    });
});
