import { logger } from "@fern-api/ui-core-utils/logger";

export async function checkRemoteRendererHealth(remoteOrigin: string, componentName: string): Promise<boolean> {
    try {
        const healthCheck = await fetch(`${remoteOrigin}/health`, {
            method: "GET",
            signal: AbortSignal.timeout(3000),
            cache: "no-store"
        });

        if (!healthCheck.ok) {
            logger.warn(
                `[${componentName}] Remote renderer health check failed (status ${healthCheck.status}). Falling back to local rendering.`
            );
            return false;
        }

        return true;
    } catch (error) {
        // Remote is unavailable - log and return false to trigger fallback
        logger.warn(
            `[${componentName}] Remote renderer unavailable: ${error instanceof Error ? error.message : String(error)}. Falling back to local rendering.`
        );
        return false;
    }
}
