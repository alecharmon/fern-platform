import type { NextRequest } from "next/server";

import { getDocsDomainEdge } from "./edge";

const mocks = vi.hoisted(() => {
    return {
        mockGetNextPublicDocsDomain: vi.fn(),
        mockCleanHost: vi.fn()
    };
});

vi.mock("./dev", () => ({
    getNextPublicDocsDomain: mocks.mockGetNextPublicDocsDomain
}));

vi.mock("./util", () => ({
    cleanHost: mocks.mockCleanHost
}));

// Constants for testing
const COOKIE_FERN_DOCS_PREVIEW = "_fern_docs_preview";
const HEADER_X_FERN_HOST = "x-fern-host";

describe("getDocsDomainEdge", () => {
    let mockRequest: Partial<NextRequest>;
    let mockHeaders: Map<string, string>;
    let mockCookies: Map<string, { value: string }>;
    let mockSearchParams: Map<string, string>;
    let mockUrl: { host: string; searchParams: Map<string, string> };

    beforeEach(() => {
        mockHeaders = new Map();
        mockCookies = new Map();
        mockSearchParams = new Map();
        mockUrl = {
            host: "example.com",
            searchParams: mockSearchParams
        };

        mockRequest = {
            headers: {
                get: (key: string) => mockHeaders.get(key) || null,
                set: (key: string, value: string) => mockHeaders.set(key, value),
                has: (key: string) => mockHeaders.has(key)
            } as any,
            cookies: {
                get: (key: string) => {
                    const cookie = mockCookies.get(key);
                    return cookie ? { value: cookie.value } : undefined;
                }
            } as any,
            nextUrl: mockUrl as any
        };

        vi.resetAllMocks();
        mocks.mockGetNextPublicDocsDomain.mockReturnValue(undefined);
        mocks.mockCleanHost.mockImplementation((host: string | null | undefined) => {
            if (!host) {
                return undefined;
            }
            if (host.includes("localhost") || host.includes("127.0.0.1")) {
                return undefined;
            }
            return host.replace(/^https?:\/\//, "").replace(/\/$/, "");
        });
    });

    describe("query parameter handling", () => {
        it("should transfer x-fern-host query parameter to header and delete from search params", () => {
            mockSearchParams.set(HEADER_X_FERN_HOST, "custom.example.com");
            mockSearchParams.set("other", "value");

            const result = getDocsDomainEdge(mockRequest as NextRequest);

            expect(mockHeaders.get(HEADER_X_FERN_HOST)).toBe("custom.example.com");
            expect(mockSearchParams.has(HEADER_X_FERN_HOST)).toBe(false);
            expect(mockSearchParams.has("other")).toBe(true);
            expect(result).toBe("custom.example.com");
        });

        it("should handle empty x-fern-host query parameter", () => {
            mockSearchParams.set(HEADER_X_FERN_HOST, "");
            mockUrl.host = "fallback.example.com";

            const result = getDocsDomainEdge(mockRequest as NextRequest);

            expect(mockHeaders.has(HEADER_X_FERN_HOST)).toBe(false);
            expect(result).toBe("fallback.example.com");
        });

        it("should not modify headers when x-fern-host query parameter is missing", () => {
            mockUrl.host = "fallback.example.com";

            const result = getDocsDomainEdge(mockRequest as NextRequest);

            expect(mockHeaders.has(HEADER_X_FERN_HOST)).toBe(false);
            expect(result).toBe("fallback.example.com");
        });
    });

    describe("host priority order", () => {
        it("should return NEXT_PUBLIC_DOCS_DOMAIN when available", () => {
            mocks.mockGetNextPublicDocsDomain.mockReturnValue("dev.example.com");

            const result = getDocsDomainEdge(mockRequest as NextRequest);

            expect(result).toBe("dev.example.com");
            expect(mocks.mockCleanHost).toHaveBeenCalledWith("dev.example.com");
        });

        it("should return cookie value when NEXT_PUBLIC_DOCS_DOMAIN is not available", () => {
            mockCookies.set(COOKIE_FERN_DOCS_PREVIEW, {
                value: "preview.example.com"
            });

            const result = getDocsDomainEdge(mockRequest as NextRequest);

            expect(result).toBe("preview.example.com");
            expect(mocks.mockCleanHost).toHaveBeenCalledWith("preview.example.com");
        });

        it("should return header value when cookie and NEXT_PUBLIC_DOCS_DOMAIN are not available", () => {
            mockHeaders.set(HEADER_X_FERN_HOST, "header.example.com");

            const result = getDocsDomainEdge(mockRequest as NextRequest);

            expect(result).toBe("header.example.com");
            expect(mocks.mockCleanHost).toHaveBeenCalledWith("header.example.com");
        });

        it("should return nextUrl.host when other sources are not available", () => {
            mockUrl.host = "url.example.com";

            const result = getDocsDomainEdge(mockRequest as NextRequest);

            expect(result).toBe("url.example.com");
            expect(mocks.mockCleanHost).toHaveBeenCalledWith("url.example.com");
        });

        it("should return buildwithfern.com when all sources fail", () => {
            mocks.mockCleanHost.mockReturnValue(undefined);

            const result = getDocsDomainEdge(mockRequest as NextRequest);

            expect(result).toBe("buildwithfern.com");
        });
    });

    describe("cleanHost integration", () => {
        it("should call cleanHost for each host value until a valid one is found", () => {
            mocks.mockGetNextPublicDocsDomain.mockReturnValue("dev.example.com");
            mocks.mockCleanHost.mockReturnValue("dev.example.com");

            getDocsDomainEdge(mockRequest as NextRequest);

            expect(mocks.mockCleanHost).toHaveBeenCalledWith("dev.example.com");
            expect(mocks.mockCleanHost).toHaveBeenCalledTimes(1);
        });

        it("should call cleanHost multiple times when earlier hosts are invalid", () => {
            mocks.mockGetNextPublicDocsDomain.mockReturnValue("invalid-host");
            mockCookies.set(COOKIE_FERN_DOCS_PREVIEW, {
                value: "preview.example.com"
            });
            mocks.mockCleanHost
                .mockReturnValueOnce(undefined) // First call returns undefined
                .mockReturnValue("preview.example.com"); // Second call returns valid host

            const result = getDocsDomainEdge(mockRequest as NextRequest);

            expect(result).toBe("preview.example.com");
            expect(mocks.mockCleanHost).toHaveBeenCalledWith("invalid-host");
            expect(mocks.mockCleanHost).toHaveBeenCalledWith("preview.example.com");
            expect(mocks.mockCleanHost).toHaveBeenCalledTimes(2);
        });

        it("should handle cleanHost returning undefined", () => {
            mocks.mockCleanHost.mockReturnValue(undefined);
            mockUrl.host = "valid.example.com";
            mocks.mockCleanHost.mockReturnValueOnce("valid.example.com"); // Only return valid for the last call

            const result = getDocsDomainEdge(mockRequest as NextRequest);

            expect(result).toBe("valid.example.com");
        });
    });

    describe("edge cases", () => {
        it("should handle null and undefined values gracefully", () => {
            mockHeaders.set(HEADER_X_FERN_HOST, "");
            mockCookies.set(COOKIE_FERN_DOCS_PREVIEW, { value: "" });
            mockUrl.host = "";

            const result = getDocsDomainEdge(mockRequest as NextRequest);

            expect(result).toBe("buildwithfern.com");
        });

        it("should handle malformed host values", () => {
            mockUrl.host = "https://malformed.example.com/";

            const _result = getDocsDomainEdge(mockRequest as NextRequest);

            expect(mocks.mockCleanHost).toHaveBeenCalledWith("https://malformed.example.com/");
        });

        it("should log error when no valid host is found", () => {
            const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
            mocks.mockCleanHost.mockReturnValue(undefined);

            const result = getDocsDomainEdge(mockRequest as NextRequest);

            expect(consoleSpy).toHaveBeenCalledWith(
                "Could not determine xFernHost from request. Returning buildwithfern.com."
            );
            expect(result).toBe("buildwithfern.com");

            consoleSpy.mockRestore();
        });
    });

    describe("integration scenarios", () => {
        it("should handle typical production scenario", () => {
            mockHeaders.set(HEADER_X_FERN_HOST, "api.example.com");

            const result = getDocsDomainEdge(mockRequest as NextRequest);

            expect(result).toBe("api.example.com");
        });

        it("should handle preview scenario with cookie", () => {
            mockCookies.set(COOKIE_FERN_DOCS_PREVIEW, {
                value: "preview.example.com"
            });

            const result = getDocsDomainEdge(mockRequest as NextRequest);

            expect(result).toBe("preview.example.com");
        });

        it("should handle development scenario", () => {
            mocks.mockGetNextPublicDocsDomain.mockReturnValue("localhost:3000");
            mocks.mockCleanHost.mockReturnValue("localhost:3000");

            const result = getDocsDomainEdge(mockRequest as NextRequest);

            expect(result).toBe("localhost:3000");
        });

        it("should handle query parameter override scenario", () => {
            mockSearchParams.set(HEADER_X_FERN_HOST, "override.example.com");
            mockHeaders.set(HEADER_X_FERN_HOST, "original.example.com");

            const result = getDocsDomainEdge(mockRequest as NextRequest);

            expect(result).toBe("override.example.com");
            expect(mockHeaders.get(HEADER_X_FERN_HOST)).toBe("override.example.com");
        });
    });
});
