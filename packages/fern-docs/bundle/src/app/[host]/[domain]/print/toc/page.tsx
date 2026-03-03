import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { PRINT_TOC_PAGE_DATA_ATTR } from "@fern-api/docs-pdf";
import { fernToken_admin } from "@fern-api/docs-server";
import { HEADER_X_FERN_TOKEN } from "@fern-api/docs-utils";
import { headers } from "next/headers";
import type { Metadata } from "next/types";
import { getFernToken } from "@/app/fern-token";
import { runAsyncSpan } from "@/server/tracing";
import { DocsPdfExportPlanner, ExportSubtreeResolutionError } from "../docs-pdf-export-planner";
import styles from "./print.module.css";
import { TocPageNumbersHydrator } from "./toc-page-numbers-client";
import { PrintTocTree } from "./toc-tree";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Server component that renders the table of contents for PDF export.
 *
 * Query parameters:
 * - `productId` (optional): The product ID to export. Defaults to the default product.
 * - `versionId` (optional): The version ID to export. Defaults to the default version.
 */
export default async function PrintTocPage(props: {
    params: Promise<{ host: string; domain: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const { host, domain } = await props.params;
    const searchParams = await props.searchParams;
    const productId = typeof searchParams.productId === "string" ? searchParams.productId : undefined;
    const versionId = typeof searchParams.versionId === "string" ? searchParams.versionId : undefined;

    const loader = await createCachedDocsLoader(host, domain, await getFernToken());
    const [{ basePath }, lang, root] = await Promise.all([
        loader.getMetadata(),
        loader.getLanguage(),
        loader.getRoot()
    ]);

    const planner = new DocsPdfExportPlanner();

    let resolution;
    try {
        resolution = planner.resolveExportSubtree(root, { productId, versionId });
    } catch (e) {
        if (e instanceof ExportSubtreeResolutionError) {
            return (
                <div data-fern-print-error data-status={e.statusCode}>
                    <h2>{"Error"}</h2>
                    <p>{e.message}</p>
                    <pre>{JSON.stringify(e.details, null, 2)}</pre>
                </div>
            );
        }
        throw e;
    }

    const reqHeaders = await headers();
    const providedToken = reqHeaders.get(HEADER_X_FERN_TOKEN) ?? reqHeaders.get("FERN_TOKEN");
    const includeAuthed = providedToken === fernToken_admin();
    const tocEntries = planner.buildExportTocEntries(resolution.subtreeRoot, { includeAuthed });

    return (
        <div
            {...{ [PRINT_TOC_PAGE_DATA_ATTR]: true }}
            data-fern-domain={domain}
            data-fern-base-path={basePath ?? "/"}
            lang={lang}
            className={styles.page}
        >
            <TocPageNumbersHydrator />
            <h2 className={styles.heading}>{"Table of Contents"}</h2>
            <ol data-fern-toc-list className={styles.listRoot}>
                <PrintTocTree entries={tocEntries} />
            </ol>
        </div>
    );
}

export async function generateMetadata(props: {
    params: Promise<{ host: string; domain: string }>;
}): Promise<Metadata> {
    return runAsyncSpan("route.print-toc.generateMetadata", async () => {
        const { domain } = await props.params;
        return {
            title: `Table of Contents – ${domain}`,
            robots: { index: false, follow: false }
        };
    });
}
