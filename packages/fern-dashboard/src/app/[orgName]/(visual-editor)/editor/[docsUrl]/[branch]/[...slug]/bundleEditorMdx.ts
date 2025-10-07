"use server";

import { createEditableDocsLoader } from "@fern-api/docs-loader";
import type { DocsLoader } from "@fern-api/docs-server/docs-loader";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { bundleMDX as internalBundleMDX } from "@/editor/mdx/bundle";
import { getHostFromHeaders } from "@/utils/getHostFromHeaders";
import type { EncodedDocsUrl } from "@/utils/types";

type BundleResult = { ok: true; code: string } | { ok: false; error: string };

export async function bundleEditorMDX(
    sources: string[],
    options?: {
        docsUrl?: EncodedDocsUrl;
        branch?: string;
    }
): Promise<BundleResult[]> {
    // Try to create a loader if docsUrl is provided
    let loader: DocsLoader | undefined;

    if (options?.docsUrl) {
        try {
            const session = await getCurrentSession();
            const host = await getHostFromHeaders();

            if (session && host) {
                const editableLoader = await createEditableDocsLoader({
                    host,
                    encodedDocsUrl: options.docsUrl,
                    fernToken: session.accessToken,
                    branchName: options.branch
                });

                loader = editableLoader;
            }
        } catch (error) {
            console.warn("Failed to create loader for MDX bundling:", error);
            // Continue without loader
        }
    }

    // Process all sources in parallel for maximum performance
    // The client-side batching (10ms window) already handles request grouping
    const results = await Promise.all(
        sources.map(async (source) => {
            try {
                const result = await internalBundleMDX(source, { loader });
                return { ok: true as const, code: result.code };
            } catch (error) {
                return {
                    ok: false as const,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        })
    );

    return results;
}
