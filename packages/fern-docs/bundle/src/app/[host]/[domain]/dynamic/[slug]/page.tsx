import "server-only";

import type { Metadata } from "next/types";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";

import { getFernToken } from "@/app/fern-token";
import RootPage from "@/app/page";
import { generateMetadataFromPage } from "@/components/seo";
import SharedPage from "@/components/shared-page";

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
    const { host, domain, slug } = await props.params;
    const loader = await createCachedDocsLoader(host, domain);
    return generateMetadataFromPage({ loader, slug: slugjoin(slug) });
}
