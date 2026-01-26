import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { NodeCollector, slugjoin } from "@fern-api/fdr-sdk/navigation";
import { NextResponse } from "next/server";

import { getFernToken } from "@/app/fern-token";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * API endpoint that returns the list of all printable page slugs.
 * Used by the PDF generator to know which pages to navigate to.
 */
export async function GET(
    request: Request,
    props: { params: Promise<{ host: string; domain: string }> }
): Promise<NextResponse> {
    const { host, domain } = await props.params;
    const loader = await createCachedDocsLoader(host, domain, await getFernToken());
    const root = await loader.getRoot();

    const collector = NodeCollector.collect(root);
    const slugs = collector.indexablePageSlugs;

    const printablePages = slugs
        .map((slug) => {
            const found = FernNavigation.utils.findNode(root, slugjoin(slug));
            if (found.type !== "found") {
                return undefined;
            }
            const slugString = String(found.node.slug);
            const node = found.node;

            // Only keep leaf nodes we know how to render in print mode.
            const isApiLeaf = FernNavigation.isApiLeaf(node);
            const pageId = FernNavigation.getPageId(node);
            if (!isApiLeaf && pageId == null) {
                return undefined;
            }

            const title = "title" in node ? node.title : undefined;

            return {
                slug: slugString,
                title
            };
        })
        .filter((x): x is { slug: string; title: string | undefined } => x != null);

    return NextResponse.json({
        pages: printablePages
    });
}
