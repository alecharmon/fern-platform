import { createCachedDocsLoader } from "@fern-api/docs-loader";
import { getDocsUrlMetadata } from "@fern-api/docs-server/getDocsUrlMetadata";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { validateApiKeyBelongsToOrg } from "@fern-api/docs-server/venus/validateApiKeyBelongsToOrg";
import { COOKIE_FERN_TOKEN } from "@fern-api/docs-utils";
import { FernNavigation } from "@fern-api/fdr-sdk";
import { logger } from "@fern-api/ui-core-utils/logger";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

interface FileSlugMapping {
    filePath: string;
    slug: string | null;
}

interface GetSlugForFileResponse {
    mappings: FileSlugMapping[];
    authed: boolean;
}

/**
 * This endpoint returns the URL slugs for given file paths in the docs.
 * It's used by CI workflows to generate preview links for changed pages.
 *
 * Query parameters:
 * - files: Comma-separated list of file paths to look up (e.g., "fern/pages/intro.mdx,fern/pages/guide.mdx")
 *
 * Returns:
 * - mappings: Array of { filePath, slug } objects
 * - authed: Whether the docs require authentication (if true, page links should not be shown)
 */
export async function GET(
    req: NextRequest,
    props: { params: Promise<{ host: string; domain: string }> }
): Promise<NextResponse<GetSlugForFileResponse | { error: string }>> {
    if (isLocal()) {
        return NextResponse.json({ error: "This endpoint is not available in local preview" }, { status: 400 });
    }

    const { host, domain } = await props.params;

    const fernToken = req.headers.get("FERN_TOKEN") ?? (await cookies()).get(COOKIE_FERN_TOKEN)?.value;

    // FERN_TOKEN is required for this endpoint
    if (!fernToken) {
        return NextResponse.json({ error: "Missing FERN_TOKEN header" }, { status: 401 });
    }

    // Validate that the FERN_TOKEN (API key) belongs to the org that owns these docs
    try {
        const metadata = await getDocsUrlMetadata(domain);
        const validation = await validateApiKeyBelongsToOrg(fernToken, metadata.org);
        if (!validation.valid) {
            logger.warn(`[${domain}] API key validation failed: ${validation.error}`);
            return NextResponse.json({ error: `Unauthorized: ${validation.error}` }, { status: 403 });
        }
    } catch (error) {
        logger.error(`[${domain}] Error validating API key:`, error);
        return NextResponse.json({ error: "Failed to validate API key" }, { status: 500 });
    }

    const filesParam = req.nextUrl.searchParams.get("files");
    if (!filesParam) {
        return NextResponse.json({ error: "Missing 'files' query parameter" }, { status: 400 });
    }

    const filePaths = filesParam
        .split(",")
        .map((f) => f.trim())
        .filter((f) => f.length > 0);
    if (filePaths.length === 0) {
        return NextResponse.json({ error: "No valid file paths provided" }, { status: 400 });
    }

    let loader;
    let root;

    try {
        loader = await createCachedDocsLoader(host, domain, fernToken);
        root = await loader.getRoot();
    } catch (error) {
        logger.error(`[${domain}] Error loading docs:`, error);
        return NextResponse.json({ error: "Failed to load docs" }, { status: 500 });
    }

    if (root == null) {
        return NextResponse.json({ error: "Docs not found" }, { status: 404 });
    }

    // Check if the docs require authentication at the root level
    const isAuthed = root.authed === true;

    // Build a mapping from pageId (file path) to slug by traversing the navigation tree
    const pageIdToSlug = new Map<string, string>();

    FernNavigation.traverseDF(root, (node) => {
        if (FernNavigation.isPage(node)) {
            const pageId = FernNavigation.getPageId(node);
            if (pageId != null) {
                // Use canonical slug if available, otherwise use the regular slug
                const slug = node.canonicalSlug ?? node.slug;
                pageIdToSlug.set(pageId, slug);
            }
        }
    });

    // Map the requested file paths to their slugs
    const mappings: FileSlugMapping[] = filePaths.map((filePath) => {
        // Try different variations of the file path to match against pageId
        // The pageId might be stored with or without the "fern/" prefix
        const variations = [filePath, filePath.replace(/^fern\//, ""), `fern/${filePath}`];

        for (const variation of variations) {
            const slug = pageIdToSlug.get(variation);
            if (slug != null) {
                return { filePath, slug };
            }
        }

        return { filePath, slug: null };
    });

    return NextResponse.json({
        mappings,
        authed: isAuthed
    });
}

export async function OPTIONS(): Promise<NextResponse> {
    return new NextResponse(null, {
        status: 200,
        headers: {
            "X-Robots-Tag": "noindex",
            Allow: "OPTIONS, GET"
        }
    });
}
