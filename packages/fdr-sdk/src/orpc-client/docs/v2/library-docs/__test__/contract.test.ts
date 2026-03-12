import { describe, expect, it } from "vitest";
import { GithubUrlSchema } from "../contract";

describe("GithubUrlSchema", () => {
    it("accepts valid GitHub repo URLs", () => {
        expect(GithubUrlSchema.safeParse("https://github.com/owner/repo").success).toBe(true);
        expect(GithubUrlSchema.safeParse("https://github.com/fern-api/fern-platform").success).toBe(true);
        expect(GithubUrlSchema.safeParse("https://github.com/my.org/my-repo").success).toBe(true);
        expect(GithubUrlSchema.safeParse("https://github.com/owner/repo.git").success).toBe(true);
        expect(GithubUrlSchema.safeParse("https://github.com/owner/repo/").success).toBe(true);
    });

    it("accepts valid GitLab repo URLs", () => {
        expect(GithubUrlSchema.safeParse("https://gitlab.com/owner/repo").success).toBe(true);
        expect(GithubUrlSchema.safeParse("https://gitlab.com/my-org/my-project").success).toBe(true);
        expect(GithubUrlSchema.safeParse("https://gitlab.com/owner/repo.git").success).toBe(true);
        expect(GithubUrlSchema.safeParse("https://gitlab.com/owner/repo/").success).toBe(true);
    });

    it("rejects URLs with trailing path segments", () => {
        expect(GithubUrlSchema.safeParse("https://github.com/owner/repo/tree/main").success).toBe(false);
        expect(GithubUrlSchema.safeParse("https://github.com/owner/repo/blob/main/README.md").success).toBe(false);
    });

    it("rejects non-HTTPS protocols", () => {
        expect(GithubUrlSchema.safeParse("http://github.com/owner/repo").success).toBe(false);
    });

    it("rejects non-github.com/gitlab.com hosts", () => {
        expect(GithubUrlSchema.safeParse("https://bitbucket.org/owner/repo").success).toBe(false);
        expect(GithubUrlSchema.safeParse("https://evil.com/owner/repo").success).toBe(false);
        expect(GithubUrlSchema.safeParse("https://169.254.169.254/latest/meta-data/").success).toBe(false);
    });

    it("rejects URLs with embedded credentials", () => {
        expect(GithubUrlSchema.safeParse("https://user@github.com/owner/repo").success).toBe(false);
        expect(GithubUrlSchema.safeParse("https://user:pass@github.com/owner/repo").success).toBe(false);
    });

    it("rejects invalid repo paths", () => {
        expect(GithubUrlSchema.safeParse("https://github.com/").success).toBe(false);
        expect(GithubUrlSchema.safeParse("https://github.com/owner").success).toBe(false);
    });

    it("rejects non-URL strings", () => {
        expect(GithubUrlSchema.safeParse("not-a-url").success).toBe(false);
        expect(GithubUrlSchema.safeParse("").success).toBe(false);
    });

    it("rejects github.com and gitlab.com subdomains", () => {
        expect(GithubUrlSchema.safeParse("https://evil.github.com/owner/repo").success).toBe(false);
        expect(GithubUrlSchema.safeParse("https://evil.gitlab.com/owner/repo").success).toBe(false);
    });

    it("rejects GitLab URLs with trailing path segments", () => {
        expect(GithubUrlSchema.safeParse("https://gitlab.com/owner/repo/tree/main").success).toBe(false);
    });
});
