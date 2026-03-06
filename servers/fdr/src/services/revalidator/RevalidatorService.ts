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
        // let revalidationFailed = false;
        try {
            app?.logger.log("Revalidating paths at", baseUrl.toURL().toString());
            const response = await fetch(`https://${baseUrl.hostname}${baseUrl.path || ""}/api/fern-docs/revalidate`, {
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

        // let revalidationFailed = false;
        // try {
        //     const client = new FernDocsClient({
        //         environment: baseUrl.toURL().toString(),
        //     });
        //     app?.logger.log("Revalidating paths at", baseUrl.toURL().toString());
        //     const page = await client.revalidation.revalidateAllV4({ limit: 100 });

        //     const successful: SuccessfulRevalidation[] = [];
        //     const failed: FailedRevalidation[] = [];

        //     for await (const result of page) {
        //         if (!result.success) {
        //             failed.push(result);
        //             app?.logger.error(`Revalidation failed for ${result.url}`, result.error);
        //         } else {
        //             successful.push(result);
        //         }
        //     }

        //     return {
        //         failed,
        //         successful,
        //         revalidationFailed: false,
        //     };
        // } catch (e) {
        //     app?.logger.error("Failed to revalidate paths", e);
        //     revalidationFailed = true;
        //     console.log(e);
        //     return { failed: [], successful: [], revalidationFailed: true };
        // }
    }
}
