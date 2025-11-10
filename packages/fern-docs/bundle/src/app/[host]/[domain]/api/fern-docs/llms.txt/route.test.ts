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
    getMarkdownForPath: vi.fn()
}));

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { track } from "@fern-api/docs-server/analytics/posthog";
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

        mockGetAuthEdgeConfig.mockResolvedValue({});
        mockGetEdgeFlags.mockResolvedValue({ isLlmsTxtDisabled: false });
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
});
