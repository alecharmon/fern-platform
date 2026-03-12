import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock React's cache() to memoize the factory result, simulating request-scoped behavior.
// In production, cache() returns the same value for the same arguments within a single
// server-component render pass. Our mock memoizes (no args → single cached result),
// and vi.resetModules() between tests gives each test a fresh module + fresh cache.
vi.mock("react", () => ({
    cache: <T>(fn: () => T): (() => T) => {
        let result: T | undefined;
        let called = false;
        return () => {
            if (!called) {
                result = fn();
                called = true;
            }
            return result as T;
        };
    }
}));

/**
 * Helper: dynamically import feature-flags.ts after setting process.env.
 * Because the module captures env vars at the top level, we must reset
 * the module registry between imports to pick up new env values.
 */
async function importFeatureFlags(env: Record<string, string | undefined>) {
    // Clean relevant env vars
    delete process.env.USE_REMOTE_RENDERING;
    delete process.env.REMOTE_RENDERER_URL;
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;

    // Apply the requested env
    for (const [key, value] of Object.entries(env)) {
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }

    vi.resetModules();
    return import("../feature-flags");
}

// ─── getRemoteRenderingMode (baseline behavior without edge config) ─────────

describe("getRemoteRenderingMode", () => {
    it('returns "disabled" when USE_REMOTE_RENDERING is not set', async () => {
        const { getRemoteRenderingMode } = await importFeatureFlags({});
        expect(getRemoteRenderingMode()).toBe("disabled");
    });

    it('returns "disabled" when USE_REMOTE_RENDERING is "false"', async () => {
        const { getRemoteRenderingMode } = await importFeatureFlags({
            USE_REMOTE_RENDERING: "false"
        });
        expect(getRemoteRenderingMode()).toBe("disabled");
    });

    it('returns "local-remote" in preview env with USE_REMOTE_RENDERING=true', async () => {
        const { getRemoteRenderingMode } = await importFeatureFlags({
            USE_REMOTE_RENDERING: "true",
            VERCEL_ENV: "preview"
        });
        expect(getRemoteRenderingMode()).toBe("local-remote");
    });

    it('returns "local-remote" for dev.ferndocs.com project with USE_REMOTE_RENDERING=true', async () => {
        const { getRemoteRenderingMode } = await importFeatureFlags({
            USE_REMOTE_RENDERING: "true",
            VERCEL_PROJECT_PRODUCTION_URL: "dev.ferndocs.com"
        });
        expect(getRemoteRenderingMode()).toBe("local-remote");
    });

    it('returns "production-remote" in production with REMOTE_RENDERER_URL set', async () => {
        const { getRemoteRenderingMode } = await importFeatureFlags({
            USE_REMOTE_RENDERING: "true",
            VERCEL_ENV: "production",
            REMOTE_RENDERER_URL: "https://remote.example.com"
        });
        expect(getRemoteRenderingMode()).toBe("production-remote");
    });

    it('returns "disabled" in production without REMOTE_RENDERER_URL', async () => {
        const { getRemoteRenderingMode } = await importFeatureFlags({
            USE_REMOTE_RENDERING: "true",
            VERCEL_ENV: "production"
        });
        expect(getRemoteRenderingMode()).toBe("disabled");
    });
});

// ─── getRemoteMDXRenderingConfig with edgeConfigOverride ────────────────────

describe("getRemoteMDXRenderingConfig with edgeConfigOverride", () => {
    describe("when global USE_REMOTE_RENDERING is disabled", () => {
        it("returns disabled mode when edgeConfigOverride is false", async () => {
            const { getRemoteMDXRenderingConfig } = await importFeatureFlags({
                VERCEL_ENV: "production",
                REMOTE_RENDERER_URL: "https://remote.example.com"
            });

            const config = getRemoteMDXRenderingConfig({ edgeConfigOverride: false });
            expect(config.enabled).toBe(false);
            expect(config.mode).toBe("disabled");
        });

        it("returns disabled mode when edgeConfigOverride is undefined", async () => {
            const { getRemoteMDXRenderingConfig } = await importFeatureFlags({
                VERCEL_ENV: "production",
                REMOTE_RENDERER_URL: "https://remote.example.com"
            });

            const config = getRemoteMDXRenderingConfig();
            expect(config.enabled).toBe(false);
            expect(config.mode).toBe("disabled");
        });

        it("enables production-remote when edgeConfigOverride is true in production env", async () => {
            const { getRemoteMDXRenderingConfig } = await importFeatureFlags({
                VERCEL_ENV: "production",
                REMOTE_RENDERER_URL: "https://remote.example.com"
            });

            const config = getRemoteMDXRenderingConfig({ edgeConfigOverride: true });
            expect(config.enabled).toBe(true);
            expect(config.mode).toBe("production-remote");
            expect(config.url).toBe("https://remote.example.com");
            expect(config.batchSerializePath).toBe("/api/batch-serialize");
            expect(config.shadow).toBe(false);
        });

        it("enables local-remote when edgeConfigOverride is true in preview env", async () => {
            const { getRemoteMDXRenderingConfig } = await importFeatureFlags({
                VERCEL_ENV: "preview",
                VERCEL_URL: "my-preview-abc123.vercel.app"
            });

            const config = getRemoteMDXRenderingConfig({ edgeConfigOverride: true });
            expect(config.enabled).toBe(true);
            expect(config.mode).toBe("local-remote");
            expect(config.url).toBe("https://my-preview-abc123.vercel.app");
            expect(config.batchSerializePath).toBe("/api/fern-docs/remote-mdx/batch-serialize");
            expect(config.shadow).toBe(false);
        });

        it("enables local-remote when edgeConfigOverride is true on dev.ferndocs.com project", async () => {
            const { getRemoteMDXRenderingConfig } = await importFeatureFlags({
                VERCEL_PROJECT_PRODUCTION_URL: "dev.ferndocs.com",
                VERCEL_URL: "dev-deploy.vercel.app"
            });

            const config = getRemoteMDXRenderingConfig({ edgeConfigOverride: true });
            expect(config.enabled).toBe(true);
            expect(config.mode).toBe("local-remote");
        });

        it("stays disabled when edgeConfigOverride is true but no REMOTE_RENDERER_URL in production", async () => {
            const { getRemoteMDXRenderingConfig } = await importFeatureFlags({
                VERCEL_ENV: "production"
                // No REMOTE_RENDERER_URL
            });

            const config = getRemoteMDXRenderingConfig({ edgeConfigOverride: true });
            // getEdgeConfigOverrideMode() returns "disabled" because no remoteRendererUrl
            expect(config.enabled).toBe(false);
            expect(config.mode).toBe("disabled");
        });
    });

    describe("when global USE_REMOTE_RENDERING is already enabled", () => {
        it("edgeConfigOverride does not change behavior (already production-remote)", async () => {
            const { getRemoteMDXRenderingConfig } = await importFeatureFlags({
                USE_REMOTE_RENDERING: "true",
                VERCEL_ENV: "production",
                REMOTE_RENDERER_URL: "https://remote.example.com"
            });

            const withOverride = getRemoteMDXRenderingConfig({ edgeConfigOverride: true });
            const withoutOverride = getRemoteMDXRenderingConfig({ edgeConfigOverride: false });

            expect(withOverride.mode).toBe("production-remote");
            expect(withoutOverride.mode).toBe("production-remote");
            expect(withOverride.enabled).toBe(true);
            expect(withoutOverride.enabled).toBe(true);
        });

        it("edgeConfigOverride does not change behavior (already local-remote)", async () => {
            const { getRemoteMDXRenderingConfig } = await importFeatureFlags({
                USE_REMOTE_RENDERING: "true",
                VERCEL_ENV: "preview"
            });

            const withOverride = getRemoteMDXRenderingConfig({ edgeConfigOverride: true });
            const withoutOverride = getRemoteMDXRenderingConfig({ edgeConfigOverride: false });

            expect(withOverride.mode).toBe("local-remote");
            expect(withoutOverride.mode).toBe("local-remote");
        });
    });
});

// ─── setEdgeConfigOverride (request-scoped cache store) ─────────────────────

describe("setEdgeConfigOverride (request-scoped store)", () => {
    it("downstream calls pick up the override without explicit parameter", async () => {
        const { setEdgeConfigOverride, getRemoteMDXRenderingConfig } = await importFeatureFlags({
            VERCEL_ENV: "production",
            REMOTE_RENDERER_URL: "https://remote.example.com"
        });

        // Before setting override: disabled
        const before = getRemoteMDXRenderingConfig();
        expect(before.enabled).toBe(false);
        expect(before.mode).toBe("disabled");

        // Set the override (simulates what SharedPage does)
        setEdgeConfigOverride(true);

        // After setting override: production-remote
        const after = getRemoteMDXRenderingConfig();
        expect(after.enabled).toBe(true);
        expect(after.mode).toBe("production-remote");
        expect(after.url).toBe("https://remote.example.com");
    });

    it("explicit edgeConfigOverride param takes precedence over store", async () => {
        const { setEdgeConfigOverride, getRemoteMDXRenderingConfig } = await importFeatureFlags({
            VERCEL_ENV: "production",
            REMOTE_RENDERER_URL: "https://remote.example.com"
        });

        // Set store to true
        setEdgeConfigOverride(true);

        // But explicitly pass false — explicit param wins via ?? operator
        // Note: explicit `false` is falsy, so ?? falls through to store's `true`
        // This matches the implementation: options?.edgeConfigOverride ?? store.override
        const config = getRemoteMDXRenderingConfig({ edgeConfigOverride: false });
        // false ?? true => false (because false is not null/undefined)
        // But false && mode === "disabled" => false, so effectiveMode stays as `mode`
        expect(config.enabled).toBe(false);
        expect(config.mode).toBe("disabled");
    });

    it("setting override to false disables it even if store was previously true", async () => {
        const { setEdgeConfigOverride, getRemoteMDXRenderingConfig } = await importFeatureFlags({
            VERCEL_ENV: "production",
            REMOTE_RENDERER_URL: "https://remote.example.com"
        });

        setEdgeConfigOverride(true);
        expect(getRemoteMDXRenderingConfig().enabled).toBe(true);

        setEdgeConfigOverride(false);
        expect(getRemoteMDXRenderingConfig().enabled).toBe(false);
    });

    it("store defaults to false when setEdgeConfigOverride is never called", async () => {
        const { getRemoteMDXRenderingConfig } = await importFeatureFlags({
            VERCEL_ENV: "production",
            REMOTE_RENDERER_URL: "https://remote.example.com"
        });

        // No setEdgeConfigOverride call — store.override is false
        const config = getRemoteMDXRenderingConfig();
        expect(config.enabled).toBe(false);
        expect(config.mode).toBe("disabled");
    });
});

// ─── getEdgeConfigOverrideMode (tested indirectly via getRemoteMDXRenderingConfig) ──

describe("getEdgeConfigOverrideMode (via edgeConfigOverride)", () => {
    it('returns "local-remote" for preview.ferndocs.com project', async () => {
        const { getRemoteMDXRenderingConfig } = await importFeatureFlags({
            VERCEL_PROJECT_PRODUCTION_URL: "preview.ferndocs.com",
            VERCEL_URL: "preview-deploy.vercel.app"
        });

        const config = getRemoteMDXRenderingConfig({ edgeConfigOverride: true });
        expect(config.mode).toBe("local-remote");
        expect(config.enabled).toBe(true);
    });

    it('returns "production-remote" for production env with REMOTE_RENDERER_URL', async () => {
        const { getRemoteMDXRenderingConfig } = await importFeatureFlags({
            VERCEL_ENV: "production",
            REMOTE_RENDERER_URL: "https://mdx-renderer.example.com"
        });

        const config = getRemoteMDXRenderingConfig({ edgeConfigOverride: true });
        expect(config.mode).toBe("production-remote");
        expect(config.enabled).toBe(true);
        expect(config.url).toBe("https://mdx-renderer.example.com");
    });

    it('returns "disabled" when no VERCEL_ENV and no REMOTE_RENDERER_URL (local dev)', async () => {
        const { getRemoteMDXRenderingConfig } = await importFeatureFlags({});

        // Local dev: isProductionEnv is true (no VERCEL_ENV) but no remoteRendererUrl
        const config = getRemoteMDXRenderingConfig({ edgeConfigOverride: true });
        expect(config.mode).toBe("disabled");
        expect(config.enabled).toBe(false);
    });

    it('returns "disabled" in production without REMOTE_RENDERER_URL even with override', async () => {
        const { getRemoteMDXRenderingConfig } = await importFeatureFlags({
            VERCEL_ENV: "production"
        });

        const config = getRemoteMDXRenderingConfig({ edgeConfigOverride: true });
        expect(config.mode).toBe("disabled");
        expect(config.enabled).toBe(false);
    });
});

// ─── Shadow mode behavior ───────────────────────────────────────────────────

describe("shadow mode", () => {
    it("shadow is enabled in production when rendering is disabled", async () => {
        const { getRemoteMDXRenderingConfig } = await importFeatureFlags({
            VERCEL_ENV: "production",
            REMOTE_RENDERER_URL: "https://remote.example.com"
        });

        const config = getRemoteMDXRenderingConfig();
        expect(config.enabled).toBe(false);
        expect(config.shadow).toBe(true);
        expect(config.url).toBe("https://remote.example.com");
    });

    it("shadow is disabled when edgeConfigOverride enables rendering", async () => {
        const { getRemoteMDXRenderingConfig } = await importFeatureFlags({
            VERCEL_ENV: "production",
            REMOTE_RENDERER_URL: "https://remote.example.com"
        });

        const config = getRemoteMDXRenderingConfig({ edgeConfigOverride: true });
        expect(config.enabled).toBe(true);
        expect(config.shadow).toBe(false);
    });
});

// ─── Cleanup ────────────────────────────────────────────────────────────────

beforeEach(() => {
    delete process.env.USE_REMOTE_RENDERING;
    delete process.env.REMOTE_RENDERER_URL;
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
});
