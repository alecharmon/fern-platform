import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import type { Metadata } from "next/types";

import { getFernToken } from "@/app/fern-token";
import RootPage from "@/app/page";
import { generateMetadataFromPage } from "@/components/seo";
import SharedPage from "@/components/shared-page";
import { runAsyncSpan } from "@/server/tracing";

export default async function DynamicPage(props: { params: Promise<{ host: string; domain: string; slug: string }> }) {
    const { host, domain, slug } = await props.params;

    if (slug === "index.html") {
        return <RootPage />;
    }

    const loader = await createCachedDocsLoader(host, domain, await getFernToken());
    return <SharedPage loader={loader} slug={slugjoin(slug)} />;
}

export async function generateMetadata(props: {
    params: Promise<{ host: string; domain: string; slug: string }>;
}): Promise<Metadata> {
    return runAsyncSpan("route.dynamic.generateMetadata", async (span) => {
        const { host, domain, slug } = await props.params;
        span.setAttributes({
            "fern.docs.host": host,
            "fern.docs.domain": domain,
            "fern.docs.slug": slug
        });
        const loader = await runAsyncSpan(
            "route.dynamic.createCachedDocsLoader",
            () => createCachedDocsLoader(host, domain),
            {
                "fern.docs.domain": domain
            }
        );
        return generateMetadataFromPage({ loader, slug: slugjoin(slug) });
    });
}
