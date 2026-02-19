import "server-only";

import { createCachedDocsLoader } from "@fern-api/docs-loader";
import type { PrintPagesResponse } from "@fern-api/docs-pdf";
import { fernToken_admin } from "@fern-api/docs-server";
import { NextResponse } from "next/server";
import { getFernToken } from "@/app/fern-token";
import { DocsPdfExportPlanner, ExportSubtreeResolutionError } from "../docs-pdf-export-planner";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * API endpoint that returns the list of all printable page slugs for a specific product/version.
 * Used by the PDF generator to know which pages to navigate to.
 *
 * Query parameters:
 * - `productId` (optional): The product ID to export. Required for multi-product docs.
 *   Defaults to the default product.
 * - `versionId` (optional): The version ID to export. Defaults to the default version.
 */
export async function GET(
    request: Request,
    props: { params: Promise<{ host: string; domain: string }> }
): Promise<NextResponse> {
    const { host, domain } = await props.params;
    const loader = await createCachedDocsLoader(host, domain, await getFernToken());
    const root = await loader.getRoot();

    const url = new URL(request.url);
    const productId = url.searchParams.get("productId") ?? undefined;
    const versionId = url.searchParams.get("versionId") ?? undefined;

    const planner = new DocsPdfExportPlanner();
    let resolution;
    try {
        resolution = planner.resolveExportSubtree(root, { productId, versionId });
    } catch (e) {
        if (e instanceof ExportSubtreeResolutionError) {
            return NextResponse.json({ error: e.message, ...e.details }, { status: e.statusCode });
        }
        throw e;
    }

    const includeAuthed = request.headers.get("FERN_TOKEN") === fernToken_admin();
    const exportablePages = planner.collectExportablePages(resolution.subtreeRoot, { includeAuthed });

    return NextResponse.json({
        pages: exportablePages,
        resolvedProduct: resolution.resolvedProduct,
        resolvedVersion: resolution.resolvedVersion,
        availableProducts: resolution.availableProducts,
        availableVersions: resolution.availableVersions
    } satisfies PrintPagesResponse);
}
