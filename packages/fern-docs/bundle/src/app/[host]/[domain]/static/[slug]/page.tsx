import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { redirect } from "next/navigation";
import type { Metadata } from "next/types";

import RootPage from "@/app/page";
import { generateMetadataFromPage } from "@/components/seo";
import SharedPage from "@/components/shared-page";
import { MdxSerializationError } from "@/server/mdx-serializer";

export const dynamic = "force-static";
export const revalidate = false;

export default async function StaticPage({
    params
}: {
    params: Promise<{ host: string; domain: string; slug: string }>;
}) {
    const { host, domain, slug } = await params;
    const rid = `${domain}-${slug}-${Date.now().toString(36).slice(-5)}`;
    console.log(`[ROUTE:${rid}] StaticPage start - domain: ${domain}, slug: ${slug}`);

    if (slug === "index.html") {
        console.log(`[ROUTE:${rid}] Returning RootPage for index.html`);
        return <RootPage />;
    }

    const loaderStart = Date.now();
    const loader = await createCachedDocsLoader(host, domain);
    const loaderDuration = Date.now() - loaderStart;
    console.log(`[ROUTE:${rid}] createCachedDocsLoader done in ${loaderDuration}ms`);

    try {
        const sharedPageStart = Date.now();
        const result = await (<SharedPage loader={loader} slug={slugjoin(slug)} throwOnSerializationError={true} />);
        const sharedPageDuration = Date.now() - sharedPageStart;
        console.log(`[ROUTE:${rid}] SharedPage done in ${sharedPageDuration}ms`);

        return result;
    } catch (error) {
        if (error instanceof MdxSerializationError) {
            console.log(`[ROUTE:${rid}] MDX serialization failed, redirecting to dynamic route`);
            redirect(`/${host}/${domain}/dynamic/${slug}`);
        }
        throw error;
    }
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
