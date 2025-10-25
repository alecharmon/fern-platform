import { describe, expect, it } from "vitest";
import {
    CACHE_KEY_ASK_AI_ENABLED,
    CACHE_KEY_COLORS,
    CACHE_KEY_CONFIG,
    CACHE_KEY_FILES,
    CACHE_KEY_FONTS,
    CACHE_KEY_LOGO_URLS,
    CACHE_KEY_MDX_BUNDLER_FILES,
    CACHE_KEY_METADATA,
    CACHE_KEY_ROOT,
    createApiCacheKey,
    createDynamicIrCacheKey,
    createPageCacheKey
} from "./cache-keys";

describe("cache-keys", () => {
    describe("constant cache keys", () => {
        it("should have consistent metadata key", () => {
            expect(CACHE_KEY_METADATA).toBe("metadata");
        });

        it("should have consistent root key", () => {
            expect(CACHE_KEY_ROOT).toBe("root");
        });

        it("should have consistent config key", () => {
            expect(CACHE_KEY_CONFIG).toBe("config");
        });

        it("should have consistent files key", () => {
            expect(CACHE_KEY_FILES).toBe("files");
        });

        it("should have consistent mdx-bundler-files key", () => {
            expect(CACHE_KEY_MDX_BUNDLER_FILES).toBe("mdx-bundler-files");
        });

        it("should have consistent colors key", () => {
            expect(CACHE_KEY_COLORS).toBe("colors");
        });

        it("should have consistent logoUrls key", () => {
            expect(CACHE_KEY_LOGO_URLS).toBe("logoUrls");
        });

        it("should have consistent fonts key", () => {
            expect(CACHE_KEY_FONTS).toBe("fonts");
        });

        it("should have consistent askAiEnabled key", () => {
            expect(CACHE_KEY_ASK_AI_ENABLED).toBe("askAiEnabled");
        });
    });

    describe("createPageCacheKey", () => {
        it("should create page cache key with correct format", () => {
            expect(createPageCacheKey({ pageId: "page-123" })).toBe("page:page-123");
        });

        it("should handle different page IDs", () => {
            expect(createPageCacheKey({ pageId: "intro" })).toBe("page:intro");
            expect(createPageCacheKey({ pageId: "getting-started" })).toBe("page:getting-started");
        });
    });

    describe("createApiCacheKey", () => {
        it("should create API cache key with correct format", () => {
            expect(createApiCacheKey({ apiId: "api-123", endpointKey: "endpoint:xyz" })).toBe(
                "api:api-123:endpoint:xyz"
            );
        });

        it("should handle different API IDs and endpoint keys", () => {
            expect(createApiCacheKey({ apiId: "users-api", endpointKey: "endpoint:getUser" })).toBe(
                "api:users-api:endpoint:getUser"
            );
            expect(createApiCacheKey({ apiId: "auth-api", endpointKey: "websocket:connect" })).toBe(
                "api:auth-api:websocket:connect"
            );
        });
    });

    describe("createDynamicIrCacheKey", () => {
        it("should create dynamic IR cache key with correct format", () => {
            expect(createDynamicIrCacheKey({ orgId: "org-123", apiName: "example.com", configHash: "api-456" })).toBe(
                "dynamicIr:org-123:example.com:api-456"
            );
        });

        it("should handle different organizations, domains, and API IDs", () => {
            expect(createDynamicIrCacheKey({ orgId: "acme", apiName: "docs.acme.com", configHash: "v1" })).toBe(
                "dynamicIr:acme:docs.acme.com:v1"
            );
        });
    });

    describe("cache key consistency", () => {
        it("should not have duplicate constant values", () => {
            const constantKeys = [
                CACHE_KEY_METADATA,
                CACHE_KEY_ROOT,
                CACHE_KEY_CONFIG,
                CACHE_KEY_FILES,
                CACHE_KEY_MDX_BUNDLER_FILES,
                CACHE_KEY_COLORS,
                CACHE_KEY_LOGO_URLS,
                CACHE_KEY_FONTS,
                CACHE_KEY_ASK_AI_ENABLED
            ];

            const uniqueKeys = new Set(constantKeys);
            expect(uniqueKeys.size).toBe(constantKeys.length);
        });

        it("should not have empty cache keys", () => {
            const constantKeys = [
                CACHE_KEY_METADATA,
                CACHE_KEY_ROOT,
                CACHE_KEY_CONFIG,
                CACHE_KEY_FILES,
                CACHE_KEY_MDX_BUNDLER_FILES,
                CACHE_KEY_COLORS,
                CACHE_KEY_LOGO_URLS,
                CACHE_KEY_FONTS,
                CACHE_KEY_ASK_AI_ENABLED
            ];

            constantKeys.forEach((key) => {
                expect(key).toBeTruthy();
                expect(key.length).toBeGreaterThan(0);
            });
        });
    });
});
