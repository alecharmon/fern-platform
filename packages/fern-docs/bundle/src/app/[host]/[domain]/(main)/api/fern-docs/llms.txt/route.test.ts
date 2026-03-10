import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fern-api/docs-loader", () => ({
    createCachedDocsLoader: vi.fn()
}));

vi.mock("@fern-api/docs-server/analytics/posthog", () => ({
    track: vi.fn()
}));

vi.mock("@fern-docs/edge-config", () => ({
    getAuthEdgeConfig: vi.fn(),
    getEdgeFlags: vi.fn()
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

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { track } from "@fern-api/docs-server/analytics/posthog";
import { DEFAULT_EDGE_FLAGS } from "@fern-api/docs-utils";
import { getAuthEdgeConfig, getEdgeFlags } from "@fern-docs/edge-config";
import { cookies } from "next/headers";
import { getSectionRoot } from "@/server/getSectionRoot";

import { GET } from "./route";

const mockCreateCachedDocsLoader = vi.mocked(createCachedDocsLoader);
const mockTrack = vi.mocked(track);
const mockGetAuthEdgeConfig = vi.mocked(getAuthEdgeConfig);
const mockGetEdgeFlags = vi.mocked(getEdgeFlags);
const mockCookies = vi.mocked(cookies);
const mockGetSectionRoot = vi.mocked(getSectionRoot);

describe("llms.txt route - authed root behavior", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockGetAuthEdgeConfig.mockResolvedValue(undefined);
        mockGetEdgeFlags.mockResolvedValue(DEFAULT_EDGE_FLAGS);
        mockCookies.mockResolvedValue({
            get: vi.fn().mockReturnValue(undefined)
        } as any);
    });

    it("should return 'User is not logged in' when root is authed", async () => {
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

        const request = new NextRequest("https://example.com/llms.txt");
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

    it("should return 'User is not logged in' when root is hidden", async () => {
        const mockRoot = {
            type: "root",
            title: "Test Docs",
            authed: false,
            hidden: true,
            child: {
                type: "unversioned",
                landingPage: null
            }
        };

        mockGetSectionRoot.mockReturnValue(mockRoot as any);
        mockCreateCachedDocsLoader.mockResolvedValue({
            getRoot: vi.fn().mockResolvedValue(mockRoot)
        } as any);

        const request = new NextRequest("https://example.com/llms.txt");
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

    it("should return 'User is not logged in' when root is both authed and hidden", async () => {
        const mockRoot = {
            type: "root",
            title: "Test Docs",
            authed: true,
            hidden: true,
            child: {
                type: "unversioned",
                landingPage: null
            }
        };

        mockGetSectionRoot.mockReturnValue(mockRoot as any);
        mockCreateCachedDocsLoader.mockResolvedValue({
            getRoot: vi.fn().mockResolvedValue(mockRoot)
        } as any);

        const request = new NextRequest("https://example.com/llms.txt");
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

    it("should return content and track when root is public", async () => {
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

        const request = new NextRequest("https://example.com/llms.txt");
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

        expect(content).toContain("# Test Docs");
        expect(content).not.toBe("User is not logged in");

        expect(mockTrack).toHaveBeenCalledWith(
            "static_content_served",
            expect.objectContaining({
                domain: "example.com",
                host: "example.com",
                staticContentType: "llms.txt",
                streaming: true
            })
        );
    });

    it("should exclude changelog entries from the output", async () => {
        const mockRoot = {
            type: "root",
            id: "root",
            title: "Test Docs",
            slug: "",
            authed: false,
            hidden: false,
            child: {
                type: "unversioned",
                id: "unversioned",
                landingPage: undefined,
                child: {
                    type: "sidebarRoot",
                    id: "sidebarRoot",
                    children: [
                        {
                            type: "sidebarGroup",
                            id: "sidebarGroup",
                            children: [
                                {
                                    type: "page",
                                    id: "page-1",
                                    title: "Getting Started",
                                    slug: "getting-started",
                                    pageId: "getting-started.mdx",
                                    hidden: false,
                                    authed: false,
                                    noindex: false
                                },
                                {
                                    type: "changelog",
                                    id: "changelog-1",
                                    title: "Changelog",
                                    slug: "changelog",
                                    hidden: false,
                                    authed: false,
                                    children: [
                                        {
                                            type: "changelogYear",
                                            id: "year-2026",
                                            title: "2026",
                                            slug: "changelog/2026",
                                            year: 2026,
                                            hidden: false,
                                            authed: false,
                                            children: [
                                                {
                                                    type: "changelogMonth",
                                                    id: "month-2",
                                                    title: "February",
                                                    slug: "changelog/2026/2",
                                                    month: 2,
                                                    hidden: false,
                                                    authed: false,
                                                    children: [
                                                        {
                                                            type: "changelogEntry",
                                                            id: "entry-1",
                                                            title: "February 25, 2026",
                                                            slug: "changelog/2026/2/25",
                                                            date: "2026-02-25",
                                                            pageId: "changelog-entry-1.mdx",
                                                            hidden: false,
                                                            authed: false,
                                                            noindex: false
                                                        },
                                                        {
                                                            type: "changelogEntry",
                                                            id: "entry-2",
                                                            title: "February 24, 2026",
                                                            slug: "changelog/2026/2/24",
                                                            date: "2026-02-24",
                                                            pageId: "changelog-entry-2.mdx",
                                                            hidden: false,
                                                            authed: false,
                                                            noindex: false
                                                        }
                                                    ]
                                                }
                                            ]
                                        }
                                    ]
                                },
                                {
                                    type: "page",
                                    id: "page-2",
                                    title: "Configuration",
                                    slug: "configuration",
                                    pageId: "configuration.mdx",
                                    hidden: false,
                                    authed: false,
                                    noindex: false
                                }
                            ]
                        }
                    ]
                }
            }
        };

        mockGetSectionRoot.mockReturnValue(mockRoot as any);
        mockCreateCachedDocsLoader.mockResolvedValue({
            getRoot: vi.fn().mockResolvedValue(mockRoot),
            getPage: vi.fn().mockImplementation((pageId: string) => {
                if (pageId === "getting-started.mdx") {
                    return Promise.resolve({
                        markdown: "---\ntitle: Getting Started\ndescription: Get started with our docs\n---\n\nWelcome!"
                    });
                }
                if (pageId === "configuration.mdx") {
                    return Promise.resolve({
                        markdown: "---\ntitle: Configuration\ndescription: Configure your setup\n---\n\nConfig content"
                    });
                }
                if (pageId === "changelog-entry-1.mdx" || pageId === "changelog-entry-2.mdx") {
                    return Promise.resolve({
                        markdown: "---\ntitle: Changelog Entry\n---\n\nSome changes"
                    });
                }
                return Promise.resolve(undefined);
            })
        } as any);

        const request = new NextRequest("https://example.com/llms.txt");
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

        // Should include regular pages
        expect(content).toContain("Getting Started");
        expect(content).toContain("Configuration");

        // Should NOT include any changelog entries
        expect(content).not.toContain("February 25, 2026");
        expect(content).not.toContain("February 24, 2026");
        expect(content).not.toContain("changelog");
    });
});
