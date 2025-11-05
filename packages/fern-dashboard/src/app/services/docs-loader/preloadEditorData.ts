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
            request.host,
            request.docsUrl,
            session.accessToken,
            request.branch
        );

        // Preload expensive operations to warm cache for editor route.
        await Promise.all([
            loader.getRoot(),
            loader.unsafe_getFullRoot(),
            loader.getMetadata(),
            loader.getConfig(),
            loader.getLayout(),
            loader.getColors()
        ]);

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: `Preload failed: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}
