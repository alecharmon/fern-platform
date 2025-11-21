import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import type { Metadata } from "next/types";

import RootPage from "@/app/page";
import { generateMetadataFromPage } from "@/components/seo";
import SharedPage from "@/components/shared-page";

export const dynamic = "force-static";
export const revalidate = false;

export default async function StaticPage({
    params
}: {
    params: Promise<{ host: string; domain: string; slug: string }>;
}) {
    const { host, domain, slug } = await params;
    const rid = `${domain}-${slug}-${Date.now().toString(36).slice(-5)}`;
    console.log(`[ROUTE:${rid}] StaticPage start - domain: ${domain}, slug: ${slug}, host: ${host}`);

    if (slug === "index.html") {
        console.log(`[ROUTE:${rid}] Returning RootPage for index.html`);
        return <RootPage />;
    }

    const loaderStart = Date.now();
    const loader = await createCachedDocsLoader(host, domain);
    const loaderDuration = Date.now() - loaderStart;
    console.log(`[ROUTE:${rid}] createCachedDocsLoader done in ${loaderDuration}ms`);

    // Log metadata for debugging
    const metadata = await loader.getMetadata();
    console.log(`[ROUTE:${rid}] Loader metadata:`, {
        domain: metadata.domain,
        basePath: metadata.basePath,
        url: metadata.url,
        org: metadata.org
    });

    const finalSlug = slugjoin(slug);
    console.log(`[ROUTE:${rid}] Processing slug:`, { rawSlug: slug, finalSlug });

    const sharedPageStart = Date.now();
    const result = await (<SharedPage loader={loader} slug={finalSlug} />);
    const sharedPageDuration = Date.now() - sharedPageStart;
    console.log(`[ROUTE:${rid}] SharedPage done in ${sharedPageDuration}ms`);

    return result;
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
