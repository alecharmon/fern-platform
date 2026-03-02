/**
 * Determines whether to use remote MDX rendering (sandboxed execution).
 * Set USE_REMOTE_RENDERING=true to enable (opt-in, not opt-out).
 *
 * Remote rendering is disabled by default unless:
 * - USE_REMOTE_RENDERING is explicitly set to "true"
 * - REMOTE_RENDERER_URL is configured
 * - VERCEL_ENV is "production" (remote rendering is disabled in preview deployments)
 */

const useRemoteRendering = process.env.USE_REMOTE_RENDERING === "true";
const remoteRendererUrl = process.env.REMOTE_RENDERER_URL;
const isProductionEnv = process.env.VERCEL_ENV === "production" || !process.env.VERCEL_ENV;

// Log configuration on startup (only once)
if (typeof global !== "undefined" && !(global as any).__remoteRenderingConfigLogged) {
    if (!useRemoteRendering) {
        console.log("[Remote Rendering] Disabled - USE_REMOTE_RENDERING not set to 'true'. Using local rendering.");
    } else if (!remoteRendererUrl) {
        console.log("[Remote Rendering] Disabled - REMOTE_RENDERER_URL not configured. Using local rendering.");
    } else if (!isProductionEnv) {
        console.log(
            `[Remote Rendering] Disabled - VERCEL_ENV is '${process.env.VERCEL_ENV}', not 'production'. Using local rendering.`
        );
    } else {
        console.log(`[Remote Rendering] Enabled - URL: ${remoteRendererUrl}`);
    }
    (global as any).__remoteRenderingConfigLogged = true;
}

export function useRemoteMDXRendering(): { enabled: boolean; url: string | undefined } {
    const enabled = useRemoteRendering && !!remoteRendererUrl && isProductionEnv;
    return { enabled, url: enabled ? remoteRendererUrl : undefined };
}
