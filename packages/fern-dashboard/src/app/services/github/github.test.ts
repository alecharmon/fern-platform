import { describe, expect, it } from "vitest";

import { getOwnerAndRepoFromGithubUrl, normalizeGithubUrl } from "./github";

describe("getOwnerAndRepoFromGithubUrl", () => {
    it("parses HTTPS URL without .git suffix", () => {
        expect(getOwnerAndRepoFromGithubUrl("https://github.com/fern-api/venus")).toEqual({
            owner: "fern-api",
            repo: "venus"
        });
    });

    it("parses HTTPS URL with .git suffix", () => {
        expect(getOwnerAndRepoFromGithubUrl("https://github.com/fern-api/venus.git")).toEqual({
            owner: "fern-api",
            repo: "venus"
        });
    });

    it("parses HTTPS URL with trailing slash", () => {
        expect(getOwnerAndRepoFromGithubUrl("https://github.com/fern-api/venus/")).toEqual({
            owner: "fern-api",
            repo: "venus"
        });
    });

    it("parses HTTPS URL with .git suffix and trailing slash", () => {
        expect(getOwnerAndRepoFromGithubUrl("https://github.com/fern-api/venus.git/")).toEqual({
            owner: "fern-api",
            repo: "venus"
        });
    });

    it("parses SSH URL with .git suffix", () => {
        expect(getOwnerAndRepoFromGithubUrl("git@github.com:fern-api/venus.git")).toEqual({
            owner: "fern-api",
            repo: "venus"
        });
    });

    it("parses SSH URL without .git suffix", () => {
        expect(getOwnerAndRepoFromGithubUrl("git@github.com:fern-api/venus")).toEqual({
            owner: "fern-api",
            repo: "venus"
        });
    });

    it("returns nulls for malformed URL (non-GitHub domain)", () => {
        expect(getOwnerAndRepoFromGithubUrl("https://example.com/fern-api/venus")).toEqual({
            owner: null,
            repo: null
        });
    });

    it("returns empty string for owner when URL has no owner/repo", () => {
        expect(getOwnerAndRepoFromGithubUrl("https://github.com/")).toEqual({
            owner: "",
            repo: null
        });
    });

    it("returns owner with null repo if repo is missing", () => {
        expect(getOwnerAndRepoFromGithubUrl("https://github.com/fern-api")).toEqual({
            owner: "fern-api",
            repo: null
        });
    });

    it("handles HTTP (non-HTTPS) URLs", () => {
        expect(getOwnerAndRepoFromGithubUrl("http://github.com/fern-api/venus")).toEqual({
            owner: "fern-api",
            repo: "venus"
        });
    });

    it("handles HTTP URLs with .git suffix", () => {
        expect(getOwnerAndRepoFromGithubUrl("http://github.com/fern-api/venus.git")).toEqual({
            owner: "fern-api",
            repo: "venus"
        });
    });
});

describe("normalizeGithubUrl", () => {
    it("normalizes HTTPS URL without .git suffix", () => {
        const result = normalizeGithubUrl("https://github.com/fern-api/venus");
        expect(result).toEqual({
            owner: "fern-api",
            repo: "venus",
            canonicalUrl: "https://github.com/fern-api/venus",
            isValidShape: true
        });
    });

    it("normalizes HTTPS URL with .git suffix", () => {
        const result = normalizeGithubUrl("https://github.com/fern-api/venus.git");
        expect(result).toEqual({
            owner: "fern-api",
            repo: "venus",
            canonicalUrl: "https://github.com/fern-api/venus",
            isValidShape: true
        });
    });

    it("normalizes HTTPS URL with trailing slash", () => {
        const result = normalizeGithubUrl("https://github.com/fern-api/venus/");
        expect(result).toEqual({
            owner: "fern-api",
            repo: "venus",
            canonicalUrl: "https://github.com/fern-api/venus",
            isValidShape: true
        });
    });

    it("normalizes SSH URL with .git suffix", () => {
        const result = normalizeGithubUrl("git@github.com:fern-api/venus.git");
        expect(result).toEqual({
            owner: "fern-api",
            repo: "venus",
            canonicalUrl: "https://github.com/fern-api/venus",
            isValidShape: true
        });
    });

    it("trims whitespace from input", () => {
        const result = normalizeGithubUrl("  https://github.com/fern-api/venus  ");
        expect(result).toEqual({
            owner: "fern-api",
            repo: "venus",
            canonicalUrl: "https://github.com/fern-api/venus",
            isValidShape: true
        });
    });

    it("returns invalid for empty string", () => {
        const result = normalizeGithubUrl("");
        expect(result).toEqual({
            owner: null,
            repo: null,
            canonicalUrl: null,
            isValidShape: false
        });
    });

    it("returns invalid for whitespace-only string", () => {
        const result = normalizeGithubUrl("   ");
        expect(result).toEqual({
            owner: null,
            repo: null,
            canonicalUrl: null,
            isValidShape: false
        });
    });

    it("returns invalid for non-GitHub URL", () => {
        const result = normalizeGithubUrl("https://example.com/fern-api/venus");
        expect(result).toEqual({
            owner: null,
            repo: null,
            canonicalUrl: null,
            isValidShape: false
        });
    });

    it("returns invalid for URL without repo", () => {
        const result = normalizeGithubUrl("https://github.com/fern-api");
        expect(result).toEqual({
            owner: "fern-api",
            repo: null,
            canonicalUrl: null,
            isValidShape: false
        });
    });

    it("returns invalid for URL with empty owner", () => {
        const result = normalizeGithubUrl("https://github.com/");
        expect(result).toEqual({
            owner: "",
            repo: null,
            canonicalUrl: null,
            isValidShape: false
        });
    });
});
