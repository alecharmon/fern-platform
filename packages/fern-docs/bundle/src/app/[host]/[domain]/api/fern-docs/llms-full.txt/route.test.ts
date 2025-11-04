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
    getMarkdownForPath: vi.fn()
}));

vi.mock("@fern-api/fdr-sdk", () => ({
    FernNavigation: {
        traverseDF: vi.fn(),
        hasMetadata: vi.fn(),
        isPage: vi.fn(),
        getPageId: vi.fn()
    }
}));

vi.mock("@fern-api/fdr-sdk/traversers", () => ({
    CONTINUE: "CONTINUE",
    SKIP: "SKIP"
}));

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { track } from "@fern-api/docs-server/analytics/posthog";
import { FernNavigation } from "@fern-api/fdr-sdk";
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
                if (done) break;
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
                if (done) break;
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

        const mockPage = {
            type: "page",
            title: "Test Page",
            slug: "test-page",
            authed: false,
            hidden: false,
            id: "page-1"
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
        mockGetPageId.mockReturnValue("page-1");
        mockGetMarkdownForPath.mockResolvedValue({
            content: "# Test Page Content"
        } as any);

        mockTraverseDF.mockImplementation((root, callback) => {
            const result = callback(mockPage as any, []);
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
                if (done) break;
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
                if (done) break;
                content += decoder.decode(value, { stream: true });
            }
        }

        expect(content).toBe("User is not logged in");

        expect(mockTrack).not.toHaveBeenCalled();
    });
});
