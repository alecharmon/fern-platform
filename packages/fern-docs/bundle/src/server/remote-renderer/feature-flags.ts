import { cache } from "react";

/**
 * Determines the MDX rendering mode:
 *
 * 1. USE_REMOTE_RENDERING is false → local rendering (default)
 * 2. USE_REMOTE_RENDERING is true AND (dev/preview Vercel project OR Vercel preview env) → local remote builder
 *    (the remote builder API route is duplicated into the main app, so we can test remote rendering
 *    without depending on the separate remote-mdx-builder deployment)
 * 3. USE_REMOTE_RENDERING is true AND production → true remote builder (external service)
 *
 * Shadow mode (fire-and-forget to remote renderer for error detection):
 * - Enabled only for production Vercel deployments when REMOTE_RENDERER_URL is configured
 * - Disabled for preview/dev (the local batch-serialize route crashes due to server-only)
 * - Local development: shadow is off
 *
 * Request-level override via `x-fern-mdx-rendering-mode` header:
 * - "production-remote" → force production-remote mode (requires REMOTE_RENDERER_URL)
 * - "local-remote" → force local-remote mode (uses bundle's own batch-serialize endpoint)
 * - Highest priority: header > edge config > env vars
 */

const useRemoteRendering = process.env.USE_REMOTE_RENDERING === "true";
const remoteRendererUrl = process.env.REMOTE_RENDERER_URL;

/**
 * Whether this is a dev or preview Vercel project, or a Vercel preview deployment.
 *
 * Matches:
 * - VERCEL_PROJECT_PRODUCTION_URL containing "dev.ferndocs.com" or "preview.ferndocs.com"
 * - VERCEL_ENV === "preview"
 */
const isPreviewOrDevProject =
    process.env.VERCEL_ENV === "preview" ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.includes("dev.ferndocs.com") === true ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.includes("preview.ferndocs.com") === true;
const isProductionEnv = process.env.VERCEL_ENV === "production" || !process.env.VERCEL_ENV;

export type RemoteRenderingMode = "disabled" | "local-remote" | "production-remote";

export function getRemoteRenderingMode(): RemoteRenderingMode {
    if (!useRemoteRendering) {
        return "disabled";
    }

    // In preview/dev projects or preview deployments, use the local remote builder
    if (isPreviewOrDevProject) {
        return "local-remote";
    }

    // In production with a configured remote renderer URL, use the true remote builder
    if (isProductionEnv && remoteRendererUrl) {
        return "production-remote";
    }

    return "disabled";
}

const mode = getRemoteRenderingMode();

/** Path to the batch-serialize endpoint on the remote renderer */
export const REMOTE_BATCH_SERIALIZE_PATH = "/api/batch-serialize";
/** Path to the batch-serialize endpoint on the local remote builder (Pages Router under fern-docs) */
export const LOCAL_BATCH_SERIALIZE_PATH = "/api/fern-docs/remote-mdx/batch-serialize";

/**
 * Request-scoped store for the edge config override.
 * Call `setEdgeConfigOverride(true)` once at the top of a request (in SharedPage or AnnouncementPage),
 * and all subsequent calls to `getRemoteMDXRenderingConfig()` within that request will pick it up.
 *
 * Uses React's `cache()` which is scoped to a single server-component render pass (i.e., one request).
 * Different requests get independent stores — no cross-request leakage.
 */
const getEdgeConfigStore = cache((): { override: boolean; modeOverride?: "local-remote" | "production-remote" } => ({
    override: false
}));

/**
 * Sets the edge config override for the current request.
 * Must be called before any `getRemoteMDXRenderingConfig()` calls in the render tree.
 */
export function setEdgeConfigOverride(override: boolean): void {
    getEdgeConfigStore().override = override;
}

/**
 * Sets a rendering mode override for the current request via the `x-fern-mdx-rendering-mode` header.
 * Takes highest priority over edge config and env vars.
 * - "production-remote" → use the deployment's REMOTE_RENDERER_URL (production-remote mode)
 * - "local-remote" → use the bundle's own batch-serialize endpoint
 */
export function setRenderingModeOverride(modeOverride: "local-remote" | "production-remote"): void {
    getEdgeConfigStore().modeOverride = modeOverride;
}

export function getRemoteMDXRenderingConfig(options?: {
    /** Per-domain override from edge config. When true, enables remote rendering for this domain. */
    edgeConfigOverride?: boolean;
}): {
    enabled: boolean;
    url: string | undefined;
    batchSerializePath: string;
    mode: RemoteRenderingMode;
    shadow: boolean;
} {
    // Check both explicit parameter and request-scoped store for edge config override
    const edgeConfigOverride = options?.edgeConfigOverride ?? getEdgeConfigStore().override;

    // Check for request-level mode override (from x-fern-mdx-rendering-mode header)
    const modeOverride = getEdgeConfigStore().modeOverride;
    if (modeOverride) {
        if (modeOverride === "production-remote" && remoteRendererUrl) {
            return {
                enabled: true,
                url: remoteRendererUrl,
                batchSerializePath: REMOTE_BATCH_SERIALIZE_PATH,
                mode: "production-remote",
                shadow: false
            };
        }
        if (modeOverride === "local-remote") {
            return {
                enabled: true,
                url: getLocalRemoteBuilderUrl(),
                batchSerializePath: LOCAL_BATCH_SERIALIZE_PATH,
                mode: "local-remote",
                shadow: false
            };
        }
        // If "production-remote" requested but no REMOTE_RENDERER_URL configured, fall through to normal logic
    }

    // If the edge config override is set for this domain, enable remote rendering
    // even if the global USE_REMOTE_RENDERING env var is not set.
    const effectiveMode = edgeConfigOverride && mode === "disabled" ? getEdgeConfigOverrideMode() : mode;

    switch (effectiveMode) {
        case "production-remote":
            return {
                enabled: true,
                url: remoteRendererUrl,
                batchSerializePath: REMOTE_BATCH_SERIALIZE_PATH,
                mode: effectiveMode,
                shadow: false
            };
        case "local-remote":
            // Use the bundle's own URL as the remote renderer URL.
            // In Vercel, VERCEL_URL provides the deployment URL.
            // We construct a self-referencing URL to hit the local API route.
            return {
                enabled: true,
                url: getLocalRemoteBuilderUrl(),
                batchSerializePath: LOCAL_BATCH_SERIALIZE_PATH,
                mode: effectiveMode,
                shadow: false
            };
        default: {
            // Shadow mode: only enabled for production Vercel deployments.
            // Preview/dev shadow is disabled because the local batch-serialize route
            // crashes due to server-only import (the noop alias requires
            // USE_REMOTE_RENDERING=true, but shadow only activates when it's false).
            const shadow = process.env.VERCEL_ENV === "production" && !!remoteRendererUrl;

            return {
                enabled: false,
                url: remoteRendererUrl,
                batchSerializePath: REMOTE_BATCH_SERIALIZE_PATH,
                mode: effectiveMode,
                shadow
            };
        }
    }
}

/**
 * Determines the rendering mode when a domain has the edge config override enabled.
 * Uses the same environment-based logic as getRemoteRenderingMode but bypasses
 * the USE_REMOTE_RENDERING check.
 */
function getEdgeConfigOverrideMode(): RemoteRenderingMode {
    if (isPreviewOrDevProject) {
        return "local-remote";
    }
    if (isProductionEnv && remoteRendererUrl) {
        return "production-remote";
    }
    // Fallback: even with edge config override, if there's no remote renderer URL
    // configured in production, we can't enable remote rendering
    return "disabled";
}

/**
 * Constructs the URL for the local remote builder API route.
 * Uses VERCEL_URL in Vercel environments, falls back to localhost:3000 for local dev.
 */
function getLocalRemoteBuilderUrl(): string {
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    return "http://localhost:3000";
}
