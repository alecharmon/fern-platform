"use server";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getCachedEditableDocsLoader } from "@/app/services/docs-loader/cachedEditableDocsLoader";
import type { EncodedDocsUrl } from "@/utils/types";

export default async function preloadEditorData(request: {
    docsUrl: EncodedDocsUrl;
    host: string;
    branch: string;
}): Promise<
    | {
          success: true;
      }
    | {
          success: false;
          error: string;
      }
> {
    try {
        const session = await getCurrentSession();
        if (session == null) {
            return { success: false, error: "No session found" };
        }

        const loader = await getCachedEditableDocsLoader(
            request.host, // Use the host from the request parameter instead of trying to get it from headers
            request.docsUrl,
            session.accessToken,
            request.branch,
            true // force revalidate when preloading
        );

        // Preload root and config in parallel
        await Promise.all([loader.getRoot(), loader.getConfig(), loader.getLayout(), loader.getFiles()]);

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: `Preload failed: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}
