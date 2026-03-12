import { describe, expect, it } from "vitest";
import {
    validateBranch,
    validateGithubUrl,
    validatePackagePath
} from "../../../services/library-docs/LibraryDocsService";

describe("validateGithubUrl", () => {
    it("accepts valid GitHub repo URLs", () => {
        expect(() => validateGithubUrl("https://github.com/owner/repo")).not.toThrow();
        expect(() => validateGithubUrl("https://github.com/fern-api/fern-platform")).not.toThrow();
        expect(() => validateGithubUrl("https://github.com/my.org/my-repo")).not.toThrow();
        expect(() => validateGithubUrl("https://github.com/owner/repo.git")).not.toThrow();
        expect(() => validateGithubUrl("https://github.com/owner/repo/")).not.toThrow();
    });

    it("accepts valid GitLab repo URLs", () => {
        expect(() => validateGithubUrl("https://gitlab.com/owner/repo")).not.toThrow();
        expect(() => validateGithubUrl("https://gitlab.com/my-org/my-project")).not.toThrow();
        expect(() => validateGithubUrl("https://gitlab.com/owner/repo.git")).not.toThrow();
        expect(() => validateGithubUrl("https://gitlab.com/owner/repo/")).not.toThrow();
    });

    it("rejects URLs with trailing path segments", () => {
        expect(() => validateGithubUrl("https://github.com/owner/repo/tree/main")).toThrow("Invalid repository path");
        expect(() => validateGithubUrl("https://github.com/owner/repo/blob/main/README.md")).toThrow(
            "Invalid repository path"
        );
        expect(() => validateGithubUrl("https://gitlab.com/owner/repo/tree/main")).toThrow("Invalid repository path");
    });

    it("rejects non-HTTPS protocols", () => {
        expect(() => validateGithubUrl("http://github.com/owner/repo")).toThrow("Only HTTPS URLs are allowed");
        expect(() => validateGithubUrl("git://github.com/owner/repo")).toThrow("Only HTTPS URLs are allowed");
        expect(() => validateGithubUrl("ftp://github.com/owner/repo")).toThrow("Only HTTPS URLs are allowed");
        expect(() => validateGithubUrl("file:///etc/passwd")).toThrow("Only HTTPS URLs are allowed");
    });

    it("rejects non-github.com/gitlab.com hosts", () => {
        expect(() => validateGithubUrl("https://bitbucket.org/owner/repo")).toThrow(
            "Only github.com and gitlab.com URLs are allowed"
        );
        expect(() => validateGithubUrl("https://evil.com/owner/repo")).toThrow(
            "Only github.com and gitlab.com URLs are allowed"
        );
        expect(() => validateGithubUrl("https://169.254.169.254/latest/meta-data/")).toThrow(
            "Only github.com and gitlab.com URLs are allowed"
        );
        expect(() => validateGithubUrl("https://10.0.0.1/owner/repo")).toThrow(
            "Only github.com and gitlab.com URLs are allowed"
        );
    });

    it("rejects URLs with embedded credentials", () => {
        expect(() => validateGithubUrl("https://user@github.com/owner/repo")).toThrow(
            "Credentials in URL are not allowed"
        );
        expect(() => validateGithubUrl("https://user:pass@github.com/owner/repo")).toThrow(
            "Credentials in URL are not allowed"
        );
    });

    it("rejects invalid repository paths", () => {
        expect(() => validateGithubUrl("https://github.com/")).toThrow("Invalid repository path");
        expect(() => validateGithubUrl("https://github.com/owner")).toThrow("Invalid repository path");
    });

    it("rejects github.com and gitlab.com subdomains", () => {
        expect(() => validateGithubUrl("https://evil.github.com/owner/repo")).toThrow(
            "Only github.com and gitlab.com URLs are allowed"
        );
        expect(() => validateGithubUrl("https://evil.gitlab.com/owner/repo")).toThrow(
            "Only github.com and gitlab.com URLs are allowed"
        );
    });

    it("throws on completely invalid URLs", () => {
        expect(() => validateGithubUrl("not-a-url")).toThrow("Invalid URL format");
        expect(() => validateGithubUrl("")).toThrow("Invalid URL format");
    });
});

describe("validateBranch", () => {
    it("accepts valid branch names", () => {
        expect(() => validateBranch("main")).not.toThrow();
        expect(() => validateBranch("feature/my-feature")).not.toThrow();
        expect(() => validateBranch("release/1.0.0")).not.toThrow();
        expect(() => validateBranch("my_branch.name")).not.toThrow();
    });

    it("accepts undefined and null", () => {
        expect(() => validateBranch(undefined)).not.toThrow();
    });

    it("rejects branch names with shell metacharacters", () => {
        expect(() => validateBranch("main; rm -rf /")).toThrow("Invalid branch name");
        expect(() => validateBranch("branch$(whoami)")).toThrow("Invalid branch name");
        expect(() => validateBranch("branch`id`")).toThrow("Invalid branch name");
        expect(() => validateBranch("branch|cat /etc/passwd")).toThrow("Invalid branch name");
        expect(() => validateBranch("branch&& echo pwned")).toThrow("Invalid branch name");
    });

    it("rejects empty string", () => {
        expect(() => validateBranch("")).toThrow("Invalid branch name");
    });
});

describe("validatePackagePath", () => {
    it("accepts valid package paths", () => {
        expect(() => validatePackagePath("src/mypackage")).not.toThrow();
        expect(() => validatePackagePath("lib")).not.toThrow();
        expect(() => validatePackagePath("packages/core")).not.toThrow();
    });

    it("accepts undefined and null", () => {
        expect(() => validatePackagePath(undefined)).not.toThrow();
    });

    it("rejects paths with '..' traversal", () => {
        expect(() => validatePackagePath("../../../etc/passwd")).toThrow("Invalid package path");
        expect(() => validatePackagePath("src/../../outside")).toThrow("Invalid package path");
        expect(() => validatePackagePath("..")).toThrow("Invalid package path");
    });

    it("rejects absolute paths", () => {
        expect(() => validatePackagePath("/etc/passwd")).toThrow("Invalid package path");
        expect(() => validatePackagePath("/tmp/evil")).toThrow("Invalid package path");
    });
});
