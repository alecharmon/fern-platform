import { fdrEnvironment, meilisearchApiKey, meilisearchOrigin } from "@fern-api/docs-server/env-variables";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { withoutStaging } from "@fern-api/docs-utils";
import { logger } from "@fern-api/ui-core-utils/logger";
import { createAlgoliaRecordsStream } from "@fern-docs/search-keyword";
import { loadDocsWithUrl } from "@fern-docs/search-utils";
import { MeiliSearch } from "meilisearch";
import { type NextRequest, NextResponse } from "next/server";

export const maxDuration = 800; // 13 minutes

/**
 * Batch size for streaming records to MeiliSearch.
 * This controls memory usage during indexing.
 * Can be overridden via MEILISEARCH_BATCH_SIZE env var.
 */
const BATCH_SIZE = parseInt(process.env.MEILISEARCH_BATCH_SIZE ?? "20000", 10);

/**
 * Fix objectIDs to be MeiliSearch-compliant (alphanumeric, hyphens, underscores only)
 */
function fixObjectId(objectID: string): string {
    return String(objectID)
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 511);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
    if (process.env.NEXT_PUBLIC_IS_SELF_HOSTED !== "1") {
        return NextResponse.json("meilisearch indexing is only accessible in self-hosted mode", { status: 400 });
    }

    const expectedKey = meilisearchApiKey();
    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!bearer || bearer !== expectedKey) {
        return NextResponse.json("Unauthorized", { status: 401 });
    }

    // Load domain from request
    const domain = getDocsDomainEdge(req);

    // Use loadDocsWithUrl to get the required docs structure
    const { org_id, root, pages, apis } = await loadDocsWithUrl({
        environment: fdrEnvironment(),
        fernToken: "dummy",
        domain: withoutStaging(domain)
    });

    // Setup MeiliSearch client
    const meiliClient = new MeiliSearch({
        host: meilisearchOrigin(),
        apiKey: meilisearchApiKey()
    });

    const meiliIndex = meiliClient.index("docs");

    // First, delete all existing documents in the "docs" index before reindexing.
    // This ensures that only the new set of records will exist after reindexing.
    try {
        // MeiliSearch v1.0+ supports deleteAllDocuments
        const deleteTask = await meiliIndex.deleteAllDocuments();
        // Wait for deletion to complete before adding new documents
        await meiliClient.tasks.waitForTask(deleteTask.taskUid, { timeout: 30000 });
        logger.info("[meilisearch] Cleared existing documents");
    } catch (err) {
        logger.warn("[meilisearch] Failed to clear existing documents:", err);
    }

    // Set filterable attributes - must wait for task to complete before adding documents
    // so that facet distribution works correctly
    const filterableTask = await meiliIndex.updateFilterableAttributes([
        "product.title",
        "version.title",
        "method",
        "availability",
        "status_code",
        "type",
        "api_type",
        "distinct"
    ]);
    await meiliClient.tasks.waitForTask(filterableTask.taskUid, { timeout: 30000 });
    logger.info("[meilisearch] Filterable attributes configured");

    const distinctTask = await meiliIndex.updateDistinctAttribute("distinct");
    await meiliClient.tasks.waitForTask(distinctTask.taskUid, { timeout: 30000 });
    logger.info("[meilisearch] Distinct attribute configured");

    // Track indexing progress
    let totalRecords = 0;
    let totalTooLarge = 0;
    const taskUids: number[] = [];
    const startTime = Date.now();

    logger.info(`[meilisearch] Starting streaming indexing with batch size ${BATCH_SIZE}...`);

    // Stream records in batches to avoid memory issues with large documentation sites
    const recordsStream = createAlgoliaRecordsStream({
        root,
        domain: withoutStaging(domain),
        org_id,
        pages,
        apis,
        batchSize: BATCH_SIZE
    });

    for await (const batch of recordsStream) {
        const { records, tooLarge, progress } = batch;

        // Fix objectIDs for MeiliSearch compliance
        const fixedRecords = records.map((rec) => ({
            ...rec,
            objectID: fixObjectId(rec.objectID)
        }));

        if (fixedRecords.length > 0) {
            try {
                const { taskUid } = await meiliIndex.addDocuments(fixedRecords, {
                    primaryKey: "objectID"
                });
                taskUids.push(taskUid);

                logger.debug(
                    `[meilisearch] Batch ${progress.batchNumber}: Added ${fixedRecords.length} documents (taskUid: ${taskUid}, total: ${progress.totalRecordsSoFar})`
                );
            } catch (err) {
                logger.error(`[meilisearch] Error adding batch ${progress.batchNumber}:`, err);
                return NextResponse.json(
                    {
                        error: `Failed to add batch ${progress.batchNumber}`,
                        details: String(err)
                    },
                    { status: 500 }
                );
            }
        }

        totalRecords = progress.totalRecordsSoFar;
        totalTooLarge += tooLarge.length;

        // Allow GC to clean up the processed batch
        // by not holding references to it
    }

    const indexingTime = Date.now() - startTime;
    logger.info(
        `[meilisearch] All ${totalRecords} records streamed in ${indexingTime}ms. Waiting for ${taskUids.length} tasks to complete...`
    );

    // Wait for all tasks to complete (or poll the last one)
    if (taskUids.length > 0) {
        const lastTaskUid = taskUids[taskUids.length - 1]!;

        // Poll the last task - MeiliSearch processes tasks in order,
        // so when the last one completes, all previous ones are done
        let task;
        for (let i = 0; i < 120; ++i) {
            // up to ~120s for very large docs
            task = await meiliClient.tasks.getTask(lastTaskUid);
            if (task.status === "succeeded") {
                break;
            }
            if (task.status === "failed" || task.status === "canceled") {
                return NextResponse.json(
                    {
                        error: `MeiliSearch reindex failed (taskUid: ${lastTaskUid}): status=${task.status}`,
                        details: task.error
                    },
                    { status: 500 }
                );
            }
            await new Promise((res) => setTimeout(res, 1000));
        }
        if (!task || task.status !== "succeeded") {
            return NextResponse.json(
                {
                    error: `MeiliSearch reindex did not succeed in time (taskUid: ${lastTaskUid}), last status: ${task?.status}`,
                    details: task?.error
                },
                { status: 500 }
            );
        }
    }

    const totalTime = Date.now() - startTime;
    logger.info(`[meilisearch] Indexing complete in ${totalTime}ms. Total records: ${totalRecords}`);

    return NextResponse.json({
        added: totalRecords,
        updated: 0,
        deleted: 0,
        unindexable: totalTooLarge,
        batchCount: taskUids.length,
        indexingTimeMs: indexingTime,
        totalTimeMs: totalTime
    });
}
