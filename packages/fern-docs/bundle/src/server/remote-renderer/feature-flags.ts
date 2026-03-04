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

export function useRemoteMDXRendering(): { enabled: boolean; url: string | undefined } {
    const enabled = useRemoteRendering && !!remoteRendererUrl && isProductionEnv;
    return { enabled, url: enabled ? remoteRendererUrl : undefined };
}
