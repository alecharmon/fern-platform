import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import type { Metadata } from "next/types";

import RootPage from "@/app/page";
import { generateMetadataFromPage } from "@/components/seo";
import SharedPage from "@/components/shared-page";

export const dynamic = "force-static";

export default async function StaticPage({
    params
}: {
    params: Promise<{ host: string; domain: string; slug: string }>;
}) {
    const { host, domain, slug } = await params;
    if (slug === "index.html") {
        return <RootPage />;
    }
    const loader = await createCachedDocsLoader(host, domain);
    return <SharedPage loader={loader} slug={slugjoin(slug)} />;
}

export async function generateMetadata({
    params
}: {
    params: Promise<{ host: string; domain: string; slug: string }>;
}): Promise<Metadata> {
    const { host, domain, slug } = await params;
    const loader = await createCachedDocsLoader(host, domain);
    return generateMetadataFromPage({ loader, slug: slugjoin(slug) });
}
