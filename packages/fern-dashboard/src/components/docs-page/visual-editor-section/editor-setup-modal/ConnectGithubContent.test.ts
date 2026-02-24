import { describe, expect, it } from "vitest";
import { validateGitUrlFormat } from "./ConnectGithubContent";

describe("validateGitUrlFormat", () => {
    describe("valid URLs", () => {
        it("accepts GitHub HTTPS URL", () => {
            expect(validateGitUrlFormat("https://github.com/owner/repo")).toBeNull();
        });

        it("accepts GitHub HTTPS URL with .git suffix", () => {
            expect(validateGitUrlFormat("https://github.com/owner/repo.git")).toBeNull();
        });

        it("accepts GitHub URL without protocol", () => {
            expect(validateGitUrlFormat("github.com/owner/repo")).toBeNull();
        });

        it("accepts GitHub URL with www", () => {
            expect(validateGitUrlFormat("https://www.github.com/owner/repo")).toBeNull();
        });

        it("accepts GitHub SSH URL", () => {
            expect(validateGitUrlFormat("git@github.com:owner/repo.git")).toBeNull();
        });

        it("accepts GitHub SSH URL without .git", () => {
            expect(validateGitUrlFormat("git@github.com:owner/repo")).toBeNull();
        });

        it("accepts GitLab HTTPS URL", () => {
            expect(validateGitUrlFormat("https://gitlab.com/owner/repo")).toBeNull();
        });

        it("accepts GitLab HTTPS URL with .git suffix", () => {
            expect(validateGitUrlFormat("https://gitlab.com/owner/repo.git")).toBeNull();
        });

        it("accepts GitLab URL with www", () => {
            expect(validateGitUrlFormat("https://www.gitlab.com/owner/repo")).toBeNull();
        });

        it("accepts GitLab SSH URL", () => {
            expect(validateGitUrlFormat("git@gitlab.com:owner/repo.git")).toBeNull();
        });

        it("accepts GitHub Enterprise URL", () => {
            expect(validateGitUrlFormat("https://github.mycompany.com/owner/repo")).toBeNull();
        });

        it("accepts repo with periods in name", () => {
            expect(validateGitUrlFormat("https://github.com/transak/docs.transak.com")).toBeNull();
        });

        it("accepts repo with periods in name and .git suffix", () => {
            expect(validateGitUrlFormat("https://github.com/transak/docs.transak.com.git")).toBeNull();
        });

        it("accepts nested GitLab group paths", () => {
            expect(validateGitUrlFormat("https://gitlab.com/group/subgroup/repo")).toBeNull();
        });

        it("accepts empty string (no error for empty input)", () => {
            expect(validateGitUrlFormat("")).toBeNull();
        });

        it("accepts whitespace-only string (treated as empty)", () => {
            expect(validateGitUrlFormat("   ")).toBeNull();
        });
    });

    describe("invalid URLs - not a git host", () => {
        it("rejects non-git-host URL", () => {
            expect(validateGitUrlFormat("https://example.com/owner/repo")).not.toBeNull();
        });

        it("rejects random domain", () => {
            expect(validateGitUrlFormat("https://docs.transak.com")).not.toBeNull();
        });

        it("rejects bitbucket URL", () => {
            expect(validateGitUrlFormat("https://bitbucket.org/owner/repo")).not.toBeNull();
        });
    });

    describe("invalid URLs - missing owner/repo path", () => {
        it("rejects GitHub URL without repo path", () => {
            const result = validateGitUrlFormat("https://github.com");
            expect(result).not.toBeNull();
            expect(result).toContain("missing");
        });

        it("rejects GitHub URL with only owner", () => {
            const result = validateGitUrlFormat("https://github.com/owner");
            expect(result).not.toBeNull();
            expect(result).toContain("missing");
        });

        it("rejects GitLab URL without repo path", () => {
            const result = validateGitUrlFormat("https://gitlab.com");
            expect(result).not.toBeNull();
        });

        it("rejects SSH URL without repo", () => {
            const result = validateGitUrlFormat("git@github.com:owner");
            expect(result).not.toBeNull();
        });

        it("rejects SSH URL with only host", () => {
            const result = validateGitUrlFormat("git@github.com:");
            expect(result).not.toBeNull();
        });
    });

    describe("invalid URLs - malformed", () => {
        it("rejects completely invalid URL", () => {
            const result = validateGitUrlFormat("not-a-url-at-all");
            expect(result).not.toBeNull();
        });
    });
});
