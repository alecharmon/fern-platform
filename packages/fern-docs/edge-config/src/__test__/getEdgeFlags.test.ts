import { describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("../getEdge", () => ({
    getAllEdge: vi.fn()
}));

vi.mock("../isLocal", () => ({
    isLocal: vi.fn()
}));

vi.mock("../isSelfHosted", () => ({
    isSelfHosted: vi.fn()
}));

import { getAllEdge } from "../getEdge";
import { getEdgeFlags } from "../getEdgeFlags";
import { isLocal } from "../isLocal";
import { isSelfHosted } from "../isSelfHosted";

const mockGetAllEdge = vi.mocked(getAllEdge);
const mockIsLocal = vi.mocked(isLocal);
const mockIsSelfHosted = vi.mocked(isSelfHosted);

function createEdgeConfig(overrides: Record<string, string[] | undefined> = {}) {
    return {
        whitelabeled: [],
        "seo-disabled": [],
        "seo-enabled": [],
        "disable-proxy": [],
        "image-zoom-disabled": [],
        "batch-stream-toggle-disabled": [],
        "audio-file-download-span-summary": [],
        "audio-example-internal": [],
        "hide-404-page": [],
        "grpc-endpoints": [],
        "authenticated-pages-discoverable": [],
        "authed-previews": [],

        "next-mdx-ref": [],
        "dynamic-snippets": [],
        "custom-react-enabled": [],
        "discriminated-union-dropdown-enabled": [],
        "search-across-all-basepaths": [],
        "use-remote-mdx-renderer": [],
        ...overrides
    };
}

describe("getEdgeFlags", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsLocal.mockReturnValue(false);
        mockIsSelfHosted.mockReturnValue(false);
    });

    describe("isRemoteMdxRenderer flag", () => {
        it("returns true when domain is in the use-remote-mdx-renderer list", async () => {
            mockGetAllEdge.mockResolvedValue(
                createEdgeConfig({
                    "use-remote-mdx-renderer": ["plantstore"]
                })
            );

            const flags = await getEdgeFlags("plantstore.docs.buildwithfern.com");
            expect(flags.isRemoteMdxRenderer).toBe(true);
        });

        it("returns false when domain is NOT in the use-remote-mdx-renderer list", async () => {
            mockGetAllEdge.mockResolvedValue(
                createEdgeConfig({
                    "use-remote-mdx-renderer": ["plantstore"]
                })
            );

            const flags = await getEdgeFlags("other-customer.docs.buildwithfern.com");
            expect(flags.isRemoteMdxRenderer).toBe(false);
        });

        it("returns false when use-remote-mdx-renderer is empty", async () => {
            mockGetAllEdge.mockResolvedValue(
                createEdgeConfig({
                    "use-remote-mdx-renderer": []
                })
            );

            const flags = await getEdgeFlags("plantstore.docs.buildwithfern.com");
            expect(flags.isRemoteMdxRenderer).toBe(false);
        });

        it("returns false when use-remote-mdx-renderer is undefined", async () => {
            mockGetAllEdge.mockResolvedValue(
                createEdgeConfig({
                    "use-remote-mdx-renderer": undefined
                })
            );

            const flags = await getEdgeFlags("plantstore.docs.buildwithfern.com");
            expect(flags.isRemoteMdxRenderer).toBe(false);
        });

        it("matches custom domain directly", async () => {
            mockGetAllEdge.mockResolvedValue(
                createEdgeConfig({
                    "use-remote-mdx-renderer": ["docs.plantstore.io"]
                })
            );

            const flags = await getEdgeFlags("docs.plantstore.io");
            expect(flags.isRemoteMdxRenderer).toBe(true);
        });

        it("matches multiple domains in the list", async () => {
            mockGetAllEdge.mockResolvedValue(
                createEdgeConfig({
                    "use-remote-mdx-renderer": ["plantstore", "garden-api", "greenhouse"]
                })
            );

            const flags1 = await getEdgeFlags("plantstore.docs.buildwithfern.com");
            const flags2 = await getEdgeFlags("garden-api.docs.buildwithfern.com");
            const flags3 = await getEdgeFlags("greenhouse.docs.buildwithfern.com");
            const flags4 = await getEdgeFlags("unrelated.docs.buildwithfern.com");

            expect(flags1.isRemoteMdxRenderer).toBe(true);
            expect(flags2.isRemoteMdxRenderer).toBe(true);
            expect(flags3.isRemoteMdxRenderer).toBe(true);
            expect(flags4.isRemoteMdxRenderer).toBe(false);
        });

        it("is case-insensitive for domain matching", async () => {
            mockGetAllEdge.mockResolvedValue(
                createEdgeConfig({
                    "use-remote-mdx-renderer": ["PlantStore"]
                })
            );

            const flags = await getEdgeFlags("plantstore.docs.buildwithfern.com");
            expect(flags.isRemoteMdxRenderer).toBe(true);
        });
    });

    describe("error fallback includes isRemoteMdxRenderer", () => {
        it("returns isRemoteMdxRenderer: false when edge config fetch fails", async () => {
            mockGetAllEdge.mockRejectedValue(new Error("Edge config unavailable"));

            const flags = await getEdgeFlags("plantstore.docs.buildwithfern.com");
            expect(flags.isRemoteMdxRenderer).toBe(false);
        });

        it("returns isRemoteMdxRenderer: false when edge config returns undefined", async () => {
            mockGetAllEdge.mockResolvedValue(undefined);

            const flags = await getEdgeFlags("plantstore.docs.buildwithfern.com");
            expect(flags.isRemoteMdxRenderer).toBe(false);
        });
    });

    describe("local and self-hosted environments", () => {
        it("returns default flags (isRemoteMdxRenderer: false) when local", async () => {
            mockIsLocal.mockReturnValue(true);

            const flags = await getEdgeFlags("localhost:3000");
            expect(flags.isRemoteMdxRenderer).toBe(false);
        });

        it("returns default self-hosted flags (isRemoteMdxRenderer: false) when self-hosted", async () => {
            mockIsSelfHosted.mockReturnValue(true);

            const flags = await getEdgeFlags("docs.plantstore.io");
            expect(flags.isRemoteMdxRenderer).toBe(false);
        });
    });
});
