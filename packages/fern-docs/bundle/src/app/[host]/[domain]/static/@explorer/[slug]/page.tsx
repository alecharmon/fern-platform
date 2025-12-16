import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { Suspense } from "react";

import { ExplorerContent, NoEndpointSelected } from "@/components/playground/ExplorerContent";
import { PlaygroundEndpointSkeleton } from "@/components/playground/endpoint";

export const revalidate = false;

export default async function ExplorerPage({
    params
}: {
    params: Promise<{ host: string; domain: string; slug: string }>;
}) {
    const { host, domain, slug: slugProp } = await params;

    if (slugProp.endsWith(".js")) {
        console.debug(`[static-explorer] returning early not found for ${slugProp}`);
        return null;
    }

    const slug = FernNavigation.slugjoin(slugProp);

    const loader = await createCachedDocsLoader(host, domain);
    const root = await loader.getRoot();

    const found = FernNavigation.utils.findNode(root, slug);
    const lang = await loader.getLanguage();

    if (found.type !== "found") {
        // Don't redirect here - let the main page handle redirects
        // Parallel routes redirecting independently causes duplicate requests
        return <NoEndpointSelected lang={lang} />;
    }
    const node = found.node;

    return (
        <Suspense fallback={<PlaygroundEndpointSkeleton />}>
            <ExplorerContent loader={loader} node={node} lang={lang} />
        </Suspense>
    );
}
