import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock server-only module
vi.mock("server-only", () => ({}));

// Mock Next.js cache
vi.mock("next/cache", () => ({
    revalidateTag: vi.fn(),
    unstable_cache: (fn: any) => fn
}));

// Mock the auth module
vi.mock("../auth0/fernBotOctokit", () => ({
    getFernBotOctokitForRepo: vi.fn()
}));

import type { DocsUrl } from "@/utils/types";
import { parseUrlsFromDocsYml, stripAndSanitizeUrl } from "../git-common";
import { GitHubLoader } from "./github-loader";

describe("GitHubLoader - Custom Domain Support", () => {
    let loader: GitHubLoader;
    let mockOctokit: any;

    beforeEach(async () => {
        // Setup mock Octokit
        mockOctokit = {
            request: vi.fn()
        };

        // Import the mocked module
        const fernBotModule = await import("../auth0/fernBotOctokit");
        vi.mocked(fernBotModule.getFernBotOctokitForRepo).mockResolvedValue({
            ok: true,
            octokit: mockOctokit
        } as any);

        loader = new GitHubLoader("https://github.com/test-org/test-repo");
    });

    describe("parseUrlsFromDocsYml", () => {
        it("should extract both url and custom-domain from instances", () => {
            const docsYmlContent = `
instances:
  - url: example-org.docs.buildwithfern.com
    custom-domain: plantstore.dev
  - url: another-site.docs.buildwithfern.com

title: Test Docs
`;

            const urls = parseUrlsFromDocsYml(docsYmlContent);

            expect(urls).toHaveLength(3);
            expect(urls).toContain("example-org.docs.buildwithfern.com");
            expect(urls).toContain("plantstore.dev");
            expect(urls).toContain("another-site.docs.buildwithfern.com");
        });

        it("should handle custom-domain with https:// protocol", () => {
            const docsYmlContent = `
instances:
  - url: https://fdr-ete-test.docs.buildwithfern.com
    custom-domain: https://fdr-ete-test.buildwithfern.com

title: FDR ETE Test
`;

            const urls = parseUrlsFromDocsYml(docsYmlContent);

            expect(urls).toHaveLength(2);
            expect(urls).toContain("https://fdr-ete-test.docs.buildwithfern.com");
            expect(urls).toContain("https://fdr-ete-test.buildwithfern.com");
        });

        it("should handle custom-domain as an array of domains", () => {
            const docsYmlContent = `
instances:
  - url: example-org.docs.buildwithfern.com
    custom-domain:
      - docs.example.com
      - docs.eu.example.com
      - docs.us-west.example.com
      - docs.staging.example.com

title: Example Docs
`;

            const urls = parseUrlsFromDocsYml(docsYmlContent);

            expect(urls).toHaveLength(5);
            expect(urls).toContain("example-org.docs.buildwithfern.com");
            expect(urls).toContain("docs.example.com");
            expect(urls).toContain("docs.eu.example.com");
            expect(urls).toContain("docs.us-west.example.com");
            expect(urls).toContain("docs.staging.example.com");
        });

        it("should handle instances without custom-domain", () => {
            const docsYmlContent = `
instances:
  - url: simple-site.docs.buildwithfern.com

title: Simple Docs
`;

            const urls = parseUrlsFromDocsYml(docsYmlContent);

            expect(urls).toHaveLength(1);
            expect(urls).toContain("simple-site.docs.buildwithfern.com");
        });

        it("should handle malformed YAML gracefully", () => {
            const docsYmlContent = `not valid yaml: [[[`;

            const urls = parseUrlsFromDocsYml(docsYmlContent);

            expect(urls).toHaveLength(0);
        });

        it("should handle missing instances section", () => {
            const docsYmlContent = `
title: Test Docs
navigation:
  - page: Home
`;

            const urls = parseUrlsFromDocsYml(docsYmlContent);

            expect(urls).toHaveLength(0);
        });
    });

    describe("stripAndSanitizeUrl", () => {
        it("should strip https:// protocol and normalize", () => {
            expect(stripAndSanitizeUrl("https://example.com")).toBe("example.com");
            expect(stripAndSanitizeUrl("http://example.com")).toBe("example.com");
            expect(stripAndSanitizeUrl("example.com")).toBe("example.com");
            expect(stripAndSanitizeUrl("HTTPS://EXAMPLE.COM")).toBe("example.com");
        });
    });

    describe("getFernProjectBySite with custom domains", () => {
        beforeEach(() => {
            // Mock repository response
            (mockOctokit.request as any).mockImplementation(async (endpoint: string, params: any) => {
                if (endpoint === "GET /repos/{owner}/{repo}") {
                    return {
                        data: {
                            default_branch: "main"
                        }
                    };
                }

                if (endpoint === "GET /repos/{owner}/{repo}/git/trees/{tree_sha}") {
                    return {
                        data: {
                            tree: [
                                {
                                    type: "blob",
                                    path: "fern/fern.config.json"
                                },
                                {
                                    type: "blob",
                                    path: "fern/docs.yml"
                                }
                            ]
                        }
                    };
                }

                if (endpoint === "GET /repos/{owner}/{repo}/commits/{ref}") {
                    return {
                        data: {
                            sha: "abc123"
                        }
                    };
                }

                if (endpoint === "GET /repos/{owner}/{repo}/contents/{path}") {
                    if (params.path === "fern/docs.yml") {
                        return {
                            data: `instances:
  - url: example-org.docs.buildwithfern.com
    custom-domain: plantstore.dev

title: Test Docs`,
                            headers: { etag: "test-etag" }
                        };
                    }
                }

                throw new Error(`Unexpected endpoint: ${endpoint}`);
            });
        });

        it("should find project by custom domain", async () => {
            const result = await loader.getFernProjectBySite("test-org", "test-repo", "plantstore.dev" as any);

            expect(result.type).toBe("ok");
            if (result.type === "ok") {
                expect(result.result.project.docsYmlPath).toBe("fern/docs.yml");
            }
        });

        it("should find project by standard url", async () => {
            const result = await loader.getFernProjectBySite(
                "test-org",
                "test-repo",
                "example-org.docs.buildwithfern.com" as DocsUrl
            );

            expect(result.type).toBe("ok");
            if (result.type === "ok") {
                expect(result.result.project.docsYmlPath).toBe("fern/docs.yml");
            }
        });

        it("should find project by one of multiple custom domains in array", async () => {
            (mockOctokit.request as any).mockImplementation(async (endpoint: string, params: any) => {
                if (endpoint === "GET /repos/{owner}/{repo}") {
                    return {
                        data: {
                            default_branch: "main"
                        }
                    };
                }

                if (endpoint === "GET /repos/{owner}/{repo}/git/trees/{tree_sha}") {
                    return {
                        data: {
                            tree: [
                                {
                                    type: "blob",
                                    path: "fern/fern.config.json"
                                },
                                {
                                    type: "blob",
                                    path: "fern/docs.yml"
                                }
                            ]
                        }
                    };
                }

                if (endpoint === "GET /repos/{owner}/{repo}/commits/{ref}") {
                    return {
                        data: {
                            sha: "abc123"
                        }
                    };
                }

                if (endpoint === "GET /repos/{owner}/{repo}/contents/{path}") {
                    if (params.path === "fern/docs.yml") {
                        return {
                            data: `instances:
  - url: example-org.docs.buildwithfern.com
    custom-domain:
      - docs.example.com
      - docs.eu.example.com
      - docs.us-west.example.com
      - docs.staging.example.com

title: Example Docs`,
                            headers: { etag: "test-etag" }
                        };
                    }
                }

                throw new Error(`Unexpected endpoint: ${endpoint}`);
            });

            const result = await loader.getFernProjectBySite(
                "test-org",
                "test-repo",
                "docs.staging.example.com" as DocsUrl
            );

            expect(result.type).toBe("ok");
            if (result.type === "ok") {
                expect(result.result.project.docsYmlPath).toBe("fern/docs.yml");
            }
        });

        it("should handle custom domain with https:// protocol", async () => {
            (mockOctokit.request as any).mockImplementation(async (endpoint: string, params: any) => {
                if (endpoint === "GET /repos/{owner}/{repo}") {
                    return {
                        data: {
                            default_branch: "main"
                        }
                    };
                }

                if (endpoint === "GET /repos/{owner}/{repo}/git/trees/{tree_sha}") {
                    return {
                        data: {
                            tree: [
                                {
                                    type: "blob",
                                    path: "fern/fern.config.json"
                                },
                                {
                                    type: "blob",
                                    path: "fern/docs.yml"
                                }
                            ]
                        }
                    };
                }

                if (endpoint === "GET /repos/{owner}/{repo}/commits/{ref}") {
                    return {
                        data: {
                            sha: "abc123"
                        }
                    };
                }

                if (endpoint === "GET /repos/{owner}/{repo}/contents/{path}") {
                    if (params.path === "fern/docs.yml") {
                        return {
                            data: `instances:
  - url: https://fdr-ete-test.docs.buildwithfern.com
    custom-domain: https://fdr-ete-test.buildwithfern.com

title: FDR ETE Test`,
                            headers: { etag: "test-etag" }
                        };
                    }
                }

                throw new Error(`Unexpected endpoint: ${endpoint}`);
            });

            const result = await loader.getFernProjectBySite(
                "test-org",
                "test-repo",
                "https://fdr-ete-test.buildwithfern.com" as DocsUrl
            );

            expect(result.type).toBe("ok");
            if (result.type === "ok") {
                expect(result.result.project.docsYmlPath).toBe("fern/docs.yml");
            }
        });
    });
});
