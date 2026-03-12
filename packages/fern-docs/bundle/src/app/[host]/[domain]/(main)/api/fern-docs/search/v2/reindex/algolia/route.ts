import { getDocsUrlMetadata, isLocal, postToSlack } from "@fern-api/docs-server";
import { track } from "@fern-api/docs-server/analytics/posthog";
import { algoliaAppId, algoliaWriteApiKey, fdrEnvironment, fernToken_admin } from "@fern-api/docs-server/env-variables";
import { Gate, withBasicTokenAnonymous } from "@fern-api/docs-server/withRbac";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { HEADER_X_FERN_BASEPATH, slugToHref, withoutStaging } from "@fern-api/docs-utils";
import { logger } from "@fern-api/ui-core-utils/logger";
import { getAuthEdgeConfig, getEdgeFlags } from "@fern-docs/edge-config";
import { algoliaIndexerTask, algoliaIndexSettingsTask, SEARCH_INDEX } from "@fern-docs/search-keyword";
import { type NextRequest, NextResponse } from "next/server";

export const maxDuration = 800; // 13 minutes

export async function GET(req: NextRequest): Promise<NextResponse> {
    if (isLocal()) {
        return NextResponse.json("algolia indexing is not accessible in local preview mode", { status: 400 });
    }

    const domain = getDocsDomainEdge(req);
    const basepath = req.headers.get(HEADER_X_FERN_BASEPATH);
    const indexerDomain =
        basepath && basepath !== "/" ? `${withoutStaging(domain)}${basepath}` : withoutStaging(domain);
    logger.info(`[algolia reindex] Indexing domain=${indexerDomain} (basepath=${basepath ?? "none"})`);

    try {
        const metadata = await getDocsUrlMetadata(domain);
        if (metadata == null) {
            return NextResponse.json("Not found", { status: 404 });
        }

        // If the domain is a preview URL, we don't want to reindex
        if (metadata.isPreview && !metadata.enableAlgoliaOnPreview) {
            return NextResponse.json({
                added: 0,
                updated: 0,
                deleted: 0,
                unindexable: 0
            });
        }

        const start = Date.now();
        const [authEdgeConfig, edgeFlags] = await Promise.all([getAuthEdgeConfig(domain), getEdgeFlags(domain)]);

        await algoliaIndexSettingsTask({
            appId: algoliaAppId(),
            writeApiKey: algoliaWriteApiKey(),
            indexName: SEARCH_INDEX
        });

        const response = await algoliaIndexerTask({
            appId: algoliaAppId(),
            writeApiKey: algoliaWriteApiKey(),
            indexName: SEARCH_INDEX,
            environment: fdrEnvironment(),
            fernToken: fernToken_admin(),
            domain: indexerDomain,
            authed: (node) => {
                if (authEdgeConfig == null) {
                    return false;
                }

                return withBasicTokenAnonymous(authEdgeConfig, slugToHref(node.slug)) === Gate.DENY;
            },
            ...edgeFlags
        });

        const end = Date.now();

        track("algolia_reindex", {
            indexName: SEARCH_INDEX,
            durationMs: end - start,
            domain,
            added: response.addedObjectIDs.length,
            updated: response.updatedObjectIDs.length,
            deleted: response.deletedObjectIDs.length,
            unindexable: response.tooLarge.length
        });

        response.tooLarge.forEach(({ record, size }) => {
            logger.warn(
                `Could not index record because it was too large: https://${record.domain}${record.pathname}${record.hash ?? ""} (${String(size)} bytes)`
            );
        });

        return NextResponse.json({
            added: response.addedObjectIDs.length,
            updated: response.updatedObjectIDs.length,
            deleted: response.deletedObjectIDs.length,
            unindexable: response.tooLarge.length
        });
    } catch (error) {
        // Log full error details including stack trace
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger.error(`[algolia] Error: ${errorMessage}`);
        if (errorStack) {
            logger.error(`[algolia] Stack trace:\n${errorStack}`);
        }

        track("algolia_reindex_error", {
            indexName: SEARCH_INDEX,
            domain,
            error: errorMessage
        });

        postToSlack(
            "#search-notifs",
            `:rotating_light: [ALGOLIA] Failed to reindex ${domain} with the following error: ${errorMessage}`,
            "algolia-reindex"
        );

        return NextResponse.json("Internal server error", { status: 500 });
    }
}
