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

export function useRemoteMDXRendering(): {
    enabled: boolean;
    url: string | undefined;
    batchSerializePath: string;
    mode: RemoteRenderingMode;
    shadow: boolean;
} {
    switch (mode) {
        case "production-remote":
            return {
                enabled: true,
                url: remoteRendererUrl,
                batchSerializePath: REMOTE_BATCH_SERIALIZE_PATH,
                mode,
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
                mode,
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
                mode,
                shadow
            };
        }
    }
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
