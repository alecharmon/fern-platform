import { describe, expect, it } from "vitest";

import { getOwnerAndRepoFromGithubUrl } from "./github";

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
