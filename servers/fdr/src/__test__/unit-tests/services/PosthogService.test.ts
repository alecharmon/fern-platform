import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPosthogService, NoOpPosthogService, PosthogServiceImpl } from "../../../services/posthog/PosthogService";

// Mock posthog-node module
vi.mock("posthog-node", () => {
    const mockCapture = vi.fn();
    const mockShutdown = vi.fn();
    return {
        PostHog: vi.fn().mockImplementation(() => ({
            capture: mockCapture,
            shutdown: mockShutdown
        }))
    };
});

describe("PosthogServiceImpl", () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        vi.clearAllMocks();
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    it("initializes with API key and captures events", async () => {
        const { PostHog } = await import("posthog-node");
        const service = new PosthogServiceImpl("test-api-key");

        service.captureDocsSitePublished({
            orgId: "org-123",
            userId: "user-abc",
            siteUrl: "docs.example.com",
            isPreview: false
        });

        const mockInstance = vi.mocked(PostHog).mock.results[0]?.value;
        expect(mockInstance.capture).toHaveBeenCalledWith({
            distinctId: "user-abc",
            event: "docs-site-published",
            properties: {
                orgId: "org-123",
                userId: "user-abc",
                siteUrl: "docs.example.com",
                isPreview: false
            }
        });
    });

    it("captures preview events correctly", async () => {
        const { PostHog } = await import("posthog-node");
        const service = new PosthogServiceImpl("test-api-key");

        service.captureDocsSitePublished({
            orgId: "org-456",
            userId: "user-xyz",
            siteUrl: "preview.docs.example.com",
            isPreview: true
        });

        const mockInstance = vi.mocked(PostHog).mock.results[0]?.value;
        expect(mockInstance.capture).toHaveBeenCalledWith({
            distinctId: "user-xyz",
            event: "docs-site-published",
            properties: {
                orgId: "org-456",
                userId: "user-xyz",
                siteUrl: "preview.docs.example.com",
                isPreview: true
            }
        });
    });

    it("catches and console.errors capture failures without throwing", async () => {
        const { PostHog } = await import("posthog-node");
        const service = new PosthogServiceImpl("test-api-key");

        const mockInstance = vi.mocked(PostHog).mock.results[0]?.value;
        const captureError = new Error("PostHog capture failed");
        mockInstance.capture.mockImplementationOnce(() => {
            throw captureError;
        });

        // Should NOT throw
        expect(() => {
            service.captureDocsSitePublished({
                orgId: "org-123",
                userId: "user-abc",
                siteUrl: "docs.example.com",
                isPreview: false
            });
        }).not.toThrow();

        expect(consoleSpy).toHaveBeenCalledWith(
            "[PosthogService] Failed to capture docs-site-published event",
            captureError
        );
    });

    it("catches and console.errors shutdown failures without throwing", async () => {
        const { PostHog } = await import("posthog-node");
        const service = new PosthogServiceImpl("test-api-key");

        const mockInstance = vi.mocked(PostHog).mock.results[0]?.value;
        const shutdownError = new Error("Shutdown failed");
        mockInstance.shutdown.mockImplementationOnce(() => {
            return Promise.reject(shutdownError);
        });

        await expect(service.shutdown()).resolves.not.toThrow();

        expect(consoleSpy).toHaveBeenCalledWith("[PosthogService] Failed to shutdown PostHog client", shutdownError);
    });

    it("calls shutdown on the underlying client", async () => {
        const { PostHog } = await import("posthog-node");
        const service = new PosthogServiceImpl("test-api-key");

        const mockInstance = vi.mocked(PostHog).mock.results[0]?.value;
        mockInstance.shutdown.mockResolvedValueOnce(undefined);

        await service.shutdown();

        expect(mockInstance.shutdown).toHaveBeenCalled();
    });
});

describe("NoOpPosthogService", () => {
    it("does not throw on captureDocsSitePublished", () => {
        const service = new NoOpPosthogService();
        expect(() => {
            service.captureDocsSitePublished({
                orgId: "org-123",
                userId: "user-abc",
                siteUrl: "docs.example.com",
                isPreview: false
            });
        }).not.toThrow();
    });

    it("does not throw on shutdown", async () => {
        const service = new NoOpPosthogService();
        await expect(service.shutdown()).resolves.not.toThrow();
    });
});

describe("createPosthogService", () => {
    const savedEnv: Record<string, string | undefined> = {};

    beforeEach(() => {
        savedEnv.POSTHOG_API_KEY = process.env.POSTHOG_API_KEY;
        delete process.env.POSTHOG_API_KEY;
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        for (const [key, value] of Object.entries(savedEnv)) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
        vi.restoreAllMocks();
    });

    it("returns NoOpPosthogService when no API key is set", () => {
        const service = createPosthogService();
        expect(service).toBeInstanceOf(NoOpPosthogService);
    });

    it("returns PosthogServiceImpl when POSTHOG_API_KEY is set", () => {
        process.env.POSTHOG_API_KEY = "phc_test_key";
        const service = createPosthogService();
        expect(service).toBeInstanceOf(PosthogServiceImpl);
    });
});
