import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fern-api/docs-loader", () => ({
    createCachedDocsLoader: vi.fn()
}));

vi.mock("@fern-api/docs-server/analytics/posthog", () => ({
    track: vi.fn()
}));

vi.mock("next/headers", () => ({
    cookies: vi.fn()
}));

vi.mock("@/server/getSectionRoot", () => ({
    getSectionRoot: vi.fn()
}));

vi.mock("@/server/getMarkdownForPath", () => ({
    getMarkdownForPath: vi.fn(),
    parseSdkLanguageFilter: vi.fn().mockImplementation((langParam: string | null) => {
        if (langParam == null) {
            return undefined;
        }
        const mappings: Record<string, string> = {
            typescript: "node",
            javascript: "node",
            node: "node",
            js: "node",
            ts: "node",
            python: "python",
            py: "python",
            java: "java",
            ruby: "ruby",
            go: "go",
            golang: "go",
            csharp: "csharp",
            swift: "swift"
        };
        return mappings[langParam.toLowerCase()];
    })
}));

vi.mock("@fern-api/fdr-sdk", () => ({
    FernNavigation: {
        traverseDF: vi.fn(),
        hasMetadata: vi.fn(),
        isPage: vi.fn(),
        getPageId: vi.fn(),
        PageId: (value: string) => value as any,
        NodeId: (value: string) => value as any,
        Slug: (value: string) => value as any
    }
}));

vi.mock("@fern-api/fdr-sdk/traversers", () => ({
    CONTINUE: true,
    SKIP: "skip"
}));

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { track } from "@fern-api/docs-server/analytics/posthog";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { SKIP } from "@fern-api/fdr-sdk/traversers";
import { cookies } from "next/headers";
import { getMarkdownForPath } from "@/server/getMarkdownForPath";
import { getSectionRoot } from "@/server/getSectionRoot";

import { GET } from "./route";

const mockCreateCachedDocsLoader = vi.mocked(createCachedDocsLoader);
const mockTrack = vi.mocked(track);
const mockCookies = vi.mocked(cookies);
const mockGetSectionRoot = vi.mocked(getSectionRoot);
const mockGetMarkdownForPath = vi.mocked(getMarkdownForPath);
const mockTraverseDF = vi.mocked(FernNavigation.traverseDF);
const mockHasMetadata = vi.mocked(FernNavigation.hasMetadata);
const mockIsPage = vi.mocked(FernNavigation.isPage);
const mockGetPageId = vi.mocked(FernNavigation.getPageId);

describe("llms-full.txt route - no accessible nodes behavior", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockCookies.mockResolvedValue({
            get: vi.fn().mockReturnValue(undefined)
        } as any);
    });

    it("should return 'User is not logged in' when there are no accessible nodes", async () => {
        const mockRoot = {
            type: "root",
            title: "Test Docs",
            authed: false,
            hidden: false,
            child: {
                type: "unversioned",
                landingPage: null
            }
        };

        mockGetSectionRoot.mockReturnValue(mockRoot as any);
        mockCreateCachedDocsLoader.mockResolvedValue({
            getRoot: vi.fn().mockResolvedValue(mockRoot)
        } as any);

        mockTraverseDF.mockImplementation((root, callback) => {});

        const request = new NextRequest("https://example.com/llms-full.txt");
        const params = Promise.resolve({ host: "example.com", domain: "example.com" });

        const response = await GET(request, { params });

        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let content = "";

        if (reader) {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                content += decoder.decode(value, { stream: true });
            }
        }

        expect(content).toBe("User is not logged in");

        expect(mockTrack).not.toHaveBeenCalled();
    });

    it("should return 'User is not logged in' when root is authed (resulting in no accessible nodes)", async () => {
        const mockRoot = {
            type: "root",
            title: "Test Docs",
            authed: true,
            hidden: false,
            child: {
                type: "unversioned",
                landingPage: null
            }
        };

        mockGetSectionRoot.mockReturnValue(mockRoot as any);
        mockCreateCachedDocsLoader.mockResolvedValue({
            getRoot: vi.fn().mockResolvedValue(mockRoot)
        } as any);

        mockTraverseDF.mockImplementation((root, callback) => {});

        const request = new NextRequest("https://example.com/llms-full.txt");
        const params = Promise.resolve({ host: "example.com", domain: "example.com" });

        const response = await GET(request, { params });

        expect(response.status).toBe(200);

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let content = "";

        if (reader) {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                content += decoder.decode(value, { stream: true });
            }
        }

        expect(content).toBe("User is not logged in");

        expect(mockTrack).not.toHaveBeenCalled();
    });

    it("should return content and track when there are accessible nodes", async () => {
        const mockRoot = {
            type: "root",
            title: "Test Docs",
            authed: false,
            hidden: false,
            child: {
                type: "unversioned",
                landingPage: null
            }
        };

        const mockPage: FernNavigation.PageNode = {
            type: "page",
            title: "Test Page",
            slug: FernNavigation.Slug("test-page"),
            authed: false,
            hidden: false,
            id: FernNavigation.NodeId("page-1"),
            pageId: FernNavigation.PageId("page-1.mdx"),
            canonicalSlug: undefined,
            icon: undefined,
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined,
            availability: undefined,
            noindex: undefined
        };

        mockGetSectionRoot.mockReturnValue(mockRoot as any);
        mockCreateCachedDocsLoader.mockResolvedValue({
            getRoot: vi.fn().mockResolvedValue(mockRoot)
        } as any);

        mockHasMetadata.mockImplementation((node: any) => {
            return node.authed !== undefined || node.hidden !== undefined;
        });
        mockIsPage.mockImplementation((node: any) => {
            return node.type === "page";
        });
        mockGetPageId.mockReturnValue(FernNavigation.PageId("page-1"));
        mockGetMarkdownForPath.mockResolvedValue({
            content: "# Test Page Content",
            contentType: "markdown"
        });

        mockTraverseDF.mockImplementation((root, callback) => {
            const result = callback(mockPage, []);
            return result;
        });

        const request = new NextRequest("https://example.com/llms-full.txt");
        const params = Promise.resolve({ host: "example.com", domain: "example.com" });

        const response = await GET(request, { params });

        expect(response.status).toBe(200);

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let content = "";

        if (reader) {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                content += decoder.decode(value, { stream: true });
            }
        }

        expect(content).not.toBe("User is not logged in");
        expect(content).toContain("# Test Page Content");

        expect(mockTrack).toHaveBeenCalledWith(
            "static_content_served",
            expect.objectContaining({
                domain: "example.com",
                host: "example.com",
                staticContentType: "llms-full.txt",
                streaming: true
            })
        );
    });

    it("should return 'User is not logged in' when all nodes are hidden", async () => {
        const mockRoot = {
            type: "root",
            title: "Test Docs",
            authed: false,
            hidden: false,
            child: {
                type: "unversioned",
                landingPage: null
            }
        };

        mockGetSectionRoot.mockReturnValue(mockRoot as any);
        mockCreateCachedDocsLoader.mockResolvedValue({
            getRoot: vi.fn().mockResolvedValue(mockRoot)
        } as any);

        mockTraverseDF.mockImplementation((root, callback) => {});

        const request = new NextRequest("https://example.com/llms-full.txt");
        const params = Promise.resolve({ host: "example.com", domain: "example.com" });

        const response = await GET(request, { params });

        expect(response.status).toBe(200);

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let content = "";

        if (reader) {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                content += decoder.decode(value, { stream: true });
            }
        }

        expect(content).toBe("User is not logged in");

        expect(mockTrack).not.toHaveBeenCalled();
    });

    it("should only include pages from the default version when multiple versions exist", async () => {
        const mockRoot = {
            type: "root",
            title: "Test Docs",
            authed: false,
            hidden: false,
            child: {
                type: "versioned",
                children: [
                    {
                        type: "version",
                        id: "version-v1",
                        slug: "v1",
                        title: "v1",
                        default: false,
                        authed: false,
                        hidden: false,
                        landingPage: null,
                        child: {
                            type: "sidebarRoot",
                            children: []
                        }
                    },
                    {
                        type: "version",
                        id: "version-v2",
                        slug: "v2",
                        title: "v2",
                        default: true,
                        authed: false,
                        hidden: false,
                        landingPage: null,
                        child: {
                            type: "sidebarRoot",
                            children: []
                        }
                    }
                ]
            }
        };

        const mockPageV1: FernNavigation.PageNode = {
            type: "page",
            title: "V1 Page",
            slug: FernNavigation.Slug("v1/page"),
            authed: false,
            hidden: false,
            id: FernNavigation.NodeId("page-v1"),
            pageId: FernNavigation.PageId("page-v1.mdx"),
            canonicalSlug: undefined,
            icon: undefined,
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined,
            availability: undefined,
            noindex: undefined
        };

        const mockPageV2: FernNavigation.PageNode = {
            type: "page",
            title: "V2 Page",
            slug: FernNavigation.Slug("v2/page"),
            authed: false,
            hidden: false,
            id: FernNavigation.NodeId("page-v2"),
            pageId: FernNavigation.PageId("page-v2.mdx"),
            canonicalSlug: undefined,
            icon: undefined,
            viewers: undefined,
            orphaned: undefined,
            featureFlags: undefined,
            availability: undefined,
            noindex: undefined
        };

        mockGetSectionRoot.mockReturnValue(mockRoot as any);
        mockCreateCachedDocsLoader.mockResolvedValue({
            getRoot: vi.fn().mockResolvedValue(mockRoot)
        } as any);

        mockHasMetadata.mockImplementation((node: any) => {
            return node.authed !== undefined || node.hidden !== undefined;
        });
        mockIsPage.mockImplementation((node: any) => {
            return node.type === "page";
        });

        const collectedPages: any[] = [];
        mockTraverseDF.mockImplementation((root, callback) => {
            const versionedNode = (root as any).child;
            for (const versionNode of versionedNode.children) {
                const result = callback(versionNode, [root, versionedNode]);
                if (result === SKIP) {
                    continue;
                }
                if (versionNode.id === "version-v2") {
                    const pageResult = callback(mockPageV2, [root, versionedNode, versionNode]);
                    if (pageResult !== SKIP) {
                        collectedPages.push(mockPageV2);
                    }
                } else if (versionNode.id === "version-v1") {
                    const pageResult = callback(mockPageV1, [root, versionedNode, versionNode]);
                    if (pageResult !== SKIP) {
                        collectedPages.push(mockPageV1);
                    }
                }
            }
        });

        mockGetPageId.mockImplementation((node: any) => node.id);
        mockGetMarkdownForPath.mockImplementation(async (node: any) => {
            return {
                content: `# ${node.title} Content`,
                contentType: "markdown"
            };
        });

        const request = new NextRequest("https://example.com/llms-full.txt");
        const params = Promise.resolve({ host: "example.com", domain: "example.com" });

        const response = await GET(request, { params });

        expect(response.status).toBe(200);

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let content = "";

        if (reader) {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                content += decoder.decode(value, { stream: true });
            }
        }

        expect(content).toContain("V2 Page Content");
        expect(content).not.toContain("V1 Page Content");

        expect(collectedPages.length).toBe(1);
        expect(collectedPages[0].id).toBe("page-v2");

        expect(mockTrack).toHaveBeenCalledWith(
            "static_content_served",
            expect.objectContaining({
                domain: "example.com",
                host: "example.com",
                staticContentType: "llms-full.txt",
                streaming: true
            })
        );
    });
});
