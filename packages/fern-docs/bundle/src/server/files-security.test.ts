/**
 * Unit tests for _files and _search endpoint security logic.
 * Tests the path traversal protection that prevents requests like
 * /_files/..%09/domain/ or /_search/indexes/..%09\keys from escaping
 * the MinIO bucket or reaching sensitive MeiliSearch endpoints.
 *
 * Self-contained to avoid importing from the middleware (which has Next.js dependencies).
 * The logic tested here mirrors the implementation in middleware.ts.
 */

/**
 * Known Fern file-hosting domain suffixes.
 * Mirrors FERN_DOCS_PREVIEW_DOMAINS from @fern-api/docs-utils.
 */
const FERN_DOCS_PREVIEW_DOMAINS = ["buildwithfern.com", "ferndocs.dev", "buildwithfern.dev", "vercel.app"];

/**
 * Mirrors the _files path validation logic from proxy.ts:
 * 1. Extract the path after "_files/"
 * 2. Reject if the decoded path contains ".."
 * 3. Validate that the first segment matches the domain or is a known Fern domain
 * 4. Build the CDN URL
 */
function validateFilesPath(
    pathname: string,
    domain?: string
): { allowed: boolean; removeBase?: string; blocked?: boolean } {
    if (!pathname.includes("/_files/")) {
        return { allowed: false };
    }

    const filePath = pathname.replace("https:/", "https://");
    const removeBase = filePath.replace(/(.*)_files\//, "");

    if (removeBase.includes("..")) {
        return { allowed: false };
    }

    // If domain is provided, also check the domain validation logic
    if (domain != null) {
        const firstSegment = removeBase.split("/")[0] ?? "";
        const isFernFileDomain = FERN_DOCS_PREVIEW_DOMAINS.some(
            (suffix) => firstSegment.endsWith(`.${suffix}`) || firstSegment === suffix
        );
        if (firstSegment !== domain && !isFernFileDomain) {
            return { allowed: false, blocked: true };
        }
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

    describe("custom domain support", () => {
        it("allows buildwithfern.com file domain when accessed from a custom domain", () => {
            const result = validateFilesPath(
                "/_files/unleash.docs.buildwithfern.com/hash123/assets/icons/quickstart.svg",
                "docs.getunleash.io"
            );
            expect(result.allowed).toBe(true);
            expect(result.removeBase).toBe("unleash.docs.buildwithfern.com/hash123/assets/icons/quickstart.svg");
        });

        it("allows ferndocs.dev file domain when accessed from a custom domain", () => {
            const result = validateFilesPath("/_files/customer.ferndocs.dev/hash123/file.svg", "docs.customer.com");
            expect(result.allowed).toBe(true);
        });

        it("allows buildwithfern.dev file domain when accessed from a custom domain", () => {
            const result = validateFilesPath(
                "/_files/customer.buildwithfern.dev/hash123/file.svg",
                "docs.customer.com"
            );
            expect(result.allowed).toBe(true);
        });

        it("allows when domain matches first segment exactly", () => {
            const result = validateFilesPath(
                "/_files/unleash.docs.buildwithfern.com/hash123/file.svg",
                "unleash.docs.buildwithfern.com"
            );
            expect(result.allowed).toBe(true);
        });

        it("rejects unknown file domain when accessed from a custom domain", () => {
            const result = validateFilesPath("/_files/evil-domain.com/hash123/secret.svg", "docs.getunleash.io");
            expect(result.allowed).toBe(false);
            expect(result.blocked).toBe(true);
        });
    });
});

/**
 * Mirrors the _search path validation logic from middleware.ts:
 * 1. Extract the path after "_search/"
 * 2. Reject if the cleaned path contains ".."
 * 3. Validate against allowed endpoint patterns
 */
function validateSearchPath(pathname: string): { allowed: boolean; cleanedPath?: string } {
    const searchMatch = pathname.match(/\/_search(\/|$)/);
    if (!searchMatch) {
        return { allowed: false };
    }

    // Simulate decodeURIComponent that middleware does on pathname
    let decodedPathname: string;
    try {
        decodedPathname = decodeURIComponent(pathname);
    } catch {
        return { allowed: false };
    }

    // Remove "/_search" prefix and normalize
    const cleanedPath = decodedPathname.replace(/^.*\/_search\/?/, "");

    // Reject path traversal
    if (cleanedPath.includes("..")) {
        return { allowed: false };
    }

    return { allowed: true, cleanedPath };
}

describe("_search path traversal protection", () => {
    describe("rejects path traversal attempts", () => {
        it("rejects ..%09%5C (tab+backslash-encoded traversal to /keys)", () => {
            const result = validateSearchPath("/_search/indexes/..%09%5Ckeys");
            expect(result.allowed).toBe(false);
        });

        it("rejects ../ (basic traversal to /keys)", () => {
            const result = validateSearchPath("/_search/indexes/../keys");
            expect(result.allowed).toBe(false);
        });

        it("rejects ..%2f (encoded slash traversal)", () => {
            const result = validateSearchPath("/_search/indexes/..%2fkeys");
            expect(result.allowed).toBe(false);
        });

        it("rejects double ..%2f traversal", () => {
            const result = validateSearchPath("/_search/indexes/..%2f..%2fkeys");
            expect(result.allowed).toBe(false);
        });

        it("rejects nested traversal", () => {
            const result = validateSearchPath("/_search/indexes/foo/../../keys");
            expect(result.allowed).toBe(false);
        });

        it("rejects traversal to /dumps", () => {
            const result = validateSearchPath("/_search/indexes/../dumps");
            expect(result.allowed).toBe(false);
        });

        it("rejects traversal to /snapshots", () => {
            const result = validateSearchPath("/_search/indexes/../snapshots");
            expect(result.allowed).toBe(false);
        });

        it("rejects traversal to /tasks", () => {
            const result = validateSearchPath("/_search/indexes/../tasks");
            expect(result.allowed).toBe(false);
        });
    });

    describe("allows valid search paths", () => {
        it("allows indexes listing", () => {
            const result = validateSearchPath("/_search/indexes");
            expect(result.allowed).toBe(true);
            expect(result.cleanedPath).toBe("indexes");
        });

        it("allows index search", () => {
            const result = validateSearchPath("/_search/indexes/docs/search");
            expect(result.allowed).toBe(true);
            expect(result.cleanedPath).toBe("indexes/docs/search");
        });

        it("allows index facet-search", () => {
            const result = validateSearchPath("/_search/indexes/docs/facet-search");
            expect(result.allowed).toBe(true);
            expect(result.cleanedPath).toBe("indexes/docs/facet-search");
        });

        it("allows multi-search", () => {
            const result = validateSearchPath("/_search/multi-search");
            expect(result.allowed).toBe(true);
            expect(result.cleanedPath).toBe("multi-search");
        });
    });

    describe("does not match non-_search paths", () => {
        it("rejects paths without _search", () => {
            const result = validateSearchPath("/some/other/path");
            expect(result.allowed).toBe(false);
        });

        it("rejects _files paths", () => {
            const result = validateSearchPath("/_files/domain.com/file.js");
            expect(result.allowed).toBe(false);
        });
    });
});
