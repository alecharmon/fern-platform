import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { PRINT_CONTENT_PAGE_DATA_ATTR } from "@fern-api/docs-pdf";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { slugjoin } from "@fern-api/fdr-sdk/navigation";
import { notFound } from "next/navigation";
import type { Metadata } from "next/types";
import { getFernToken } from "@/app/fern-token";
import ApiEndpointPage from "@/components/api-reference/ApiEndpointPage";
import { LayoutEvaluator } from "@/components/layouts/LayoutEvaluator";
import { createCachedMdxSerializer } from "@/server/mdx-serializer";
import { runAsyncSpan } from "@/server/tracing";
import styles from "./print.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PrintSinglePage(props: {
    params: Promise<{ host: string; domain: string; slug: string[] }>;
}) {
    const { host, domain, slug: slugParts } = await props.params;
    const loader = await createCachedDocsLoader(host, domain, await getFernToken());
    const [{ basePath }, lang, root, edgeFlags] = await Promise.all([
        loader.getMetadata(),
        loader.getLanguage(),
        loader.getRoot(),
        loader.getEdgeFlags()
    ]);

    const serialize = createCachedMdxSerializer(loader, { useNextMdx: edgeFlags.isNextMdxRef });

    const slug = slugjoin(...slugParts);
    const found = FernNavigation.utils.findNode(root, slug);

    if (found.type !== "found") {
        notFound();
    }

    const node = found.node;
    const slugString = String(slug);

    return (
        <div
            {...{ [PRINT_CONTENT_PAGE_DATA_ATTR]: true }}
            data-fern-domain={domain}
            data-fern-base-path={basePath ?? "/"}
            data-fern-slug={slugString}
            id={`page-${slugString}`}
            lang={lang}
            className={styles.root}
        >
            {FernNavigation.isApiLeaf(node) ? (
                <ApiEndpointPage
                    loader={loader}
                    serialize={serialize}
                    node={node}
                    breadcrumb={found.breadcrumb}
                    lang={lang}
                />
            ) : FernNavigation.getPageId(node) != null ? (
                <LayoutEvaluator
                    loader={loader}
                    serialize={serialize}
                    fallbackTitle={"title" in node ? node.title : "Untitled"}
                    pageId={FernNavigation.getPageId(node)!}
                    breadcrumb={found.breadcrumb}
                    slug={slugString}
                    availability={node.type === "page" || node.type === "section" ? node.availability : undefined}
                />
            ) : (
                <div>
                    <p className="opacity-75">Unsupported node type for print: {node.type}</p>
                </div>
            )}
        </div>
    );
}

export async function generateMetadata(props: {
    params: Promise<{ host: string; domain: string; slug: string[] }>;
}): Promise<Metadata> {
    return runAsyncSpan("route.print-single-page.generateMetadata", async () => {
        const { domain, slug } = await props.params;
        return {
            title: `Print – ${slug.join("/")} – ${domain}`,
            robots: { index: false, follow: false }
        };
    });
}
