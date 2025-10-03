import { createEditableDocsLoader } from "@fern-api/docs-loader";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";

export default async function preloadEditorData(request: { docsUrl: string; host: string }): Promise<{
    success: boolean;
    error?: string;
}> {
    const session = await getCurrentSession();
    if (session == null) {
        return { success: false, error: "No session found" };
    }

    try {
        // Preload the critical data that the editor will need
        const loader = await createEditableDocsLoader({
            host: request.host, // Use the host from the request parameter instead of trying to get it from headers
            encodedDocsUrl: request.docsUrl,
            fernToken: session.accessToken,
            forceRevalidate: true // force revalidate when preloading
        });

        // Preload root and config in parallel
        await Promise.all([loader.getRoot(), loader.getConfig(), loader.getLayout()]);

        return { success: true };
    } catch (error) {
        return {
            success: false,
            error: `Preload failed: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}
