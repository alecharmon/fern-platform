import type { FdrApplication } from "../../app";
import type { ParsedBaseUrl } from "../../util/ParsedBaseUrl";

export interface SuccessfulRevalidation {
    success: true;
    url: string;
}

export interface FailedRevalidation {
    success: false;
    url: string;
    error: string;
}

export type RevalidatedPathsResponse = {
    successful: SuccessfulRevalidation[];
    failed: FailedRevalidation[];
    revalidationFailed: boolean;
};

export interface RevalidatorService {
    revalidate(params: {
        baseUrl: ParsedBaseUrl;
        app: FdrApplication;
        authHeader: string;
    }): Promise<RevalidatedPathsResponse>;
}

export class RevalidatorServiceImpl implements RevalidatorService {
    // private readonly semaphore = new Semaphore(50);

    /**
     * NOTE on basepath revalidation:
     *
     * When the baseUrl.path is not null, the custom domain is re-written. Thus,
     * /api/revalidate-all does not exist on the root, but `/base/path/api/revalidate-all` does (rewritten via frontend middleware).
     *
     * Behind the scenes, the revalidation request is sent to the original domain, i.e. org.docs.buildwithfern.com.
     *
     * Example prefetch request:
     * https://custom-domain.com/path/_next/data/.../static/custom-domain.com/path.json is rewritten to:
     * https://org.docs.buildwithfern.com/path/_next/data/.../static/custom-domain.com/path.json
     *
     * So `/static/custom-domain.com/path` is the path we need to revalidate on org.docs.buildwithfern.com
     */

    public async revalidate({
        baseUrl,
        app,
        authHeader
    }: {
        baseUrl: ParsedBaseUrl;
        app?: FdrApplication;
        authHeader: string;
    }): Promise<RevalidatedPathsResponse> {
        const baseUrlStr = `https://${baseUrl.hostname}${baseUrl.path || ""}`;

        // Step 1: Call invalidate as a separate request to clear all caches.
        // This must complete in its own request lifecycle so that revalidateTag()
        // mutations are committed before the revalidation request reads data.
        try {
            app?.logger.log("Invalidating caches at", baseUrlStr);
            const invalidateResponse = await fetch(`${baseUrlStr}/api/fern-docs/invalidate`, {
                signal: AbortSignal.timeout(30_000)
            });
            await invalidateResponse.text().catch(() => {});
            if (!invalidateResponse.ok) {
                app?.logger.error(`Invalidation failed with status ${invalidateResponse.status} for ${baseUrlStr}`);
            }
        } catch (e) {
            // Log but don't fail — revalidation can still proceed
            app?.logger.error("Failed to invalidate caches", e);
        }

        // Step 2: Call revalidate to load fresh data and regenerate pages.
        try {
            app?.logger.log("Revalidating paths at", baseUrlStr);
            const response = await fetch(`${baseUrlStr}/api/fern-docs/revalidate`, {
                headers: {
                    authorization: authHeader
                }
            });
            // Consume the response body to ensure proper HTTP cleanup.
            // The revalidation endpoint may return a streaming response;
            // the actual work now completes via waitUntil() on the server
            // regardless of whether this body is consumed.
            await response.text().catch(() => {});
            return {
                successful: [],
                failed: [],
                revalidationFailed: !response.ok
            };
        } catch (e) {
            app?.logger.error("Failed to revalidate paths", e);
            console.log(e);
            return {
                successful: [],
                failed: [],
                revalidationFailed: true
            };
        }
    }
}
