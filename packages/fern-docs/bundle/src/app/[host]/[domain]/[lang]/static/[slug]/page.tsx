import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import type { Metadata } from "next/types";

import RootPage from "@/app/page";
import type { PageParams } from "@/app/types";
import { generateMetadataFromPage } from "@/components/seo";
import SharedPage from "@/components/shared-page";

export const dynamic = "force-static";
export const revalidate = false;

export default async function StaticPage({ params }: { params: Promise<PageParams> }) {
    const { host, domain, lang, slug } = await params;
    if (slug === "index.html") {
        return <RootPage />;
    }
    const loader = await createCachedDocsLoader(host, domain);
    return <SharedPage loader={loader} slug={slugjoin(slug)} />;
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
    const { host, domain, lang, slug } = await params;
    const loader = await createCachedDocsLoader(host, domain);
    return generateMetadataFromPage({ loader, slug: slugjoin(slug) });
}
