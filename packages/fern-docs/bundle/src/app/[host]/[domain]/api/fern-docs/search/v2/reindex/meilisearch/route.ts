import { fdrEnvironment, meilisearchApiKey, meilisearchOrigin } from "@fern-api/docs-server/env-variables";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { withoutStaging } from "@fern-api/docs-utils";
import { createAlgoliaRecords } from "@fern-docs/search-keyword";
import { loadDocsWithUrl } from "@fern-docs/search-utils";
import { MeiliSearch } from "meilisearch";
import { type NextRequest, NextResponse } from "next/server";

export const maxDuration = 800; // 13 minutes

export async function GET(req: NextRequest): Promise<NextResponse> {
    if (process.env.NEXT_PUBLIC_IS_SELF_HOSTED !== "1") {
        return NextResponse.json("meilisearch indexing is only accessible in self-hosted mode", { status: 400 });
    }

    // Load domain from request
    const domain = getDocsDomainEdge(req);

    // Use loadDocsWithUrl to get the required docs structure
    const { org_id, root, pages, apis } = await loadDocsWithUrl({
        environment: fdrEnvironment(),
        fernToken: "dummy",
        domain: withoutStaging(domain)
    });

    const { records: targetRecords, tooLarge } = await createAlgoliaRecords({
        root,
        domain: withoutStaging(domain),
        org_id,
        pages,
        apis
        // authed: ... // If you want to pass an authed function, add here
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
        await meiliIndex.deleteAllDocuments();
        // Optionally, you could wait for the deletion task to complete, but since we immediately addDocuments,
        // MeiliSearch will queue the operations in order.
    } catch (_err) {}

    // Set filterable attributes
    await meiliIndex.updateFilterableAttributes([
        "product.title",
        "version.title",
        "method",
        "availability",
        "status_code",
        "type",
        "api_type",
        "distinct"
    ]);

    await meiliIndex.updateDistinctAttribute("distinct");

    // Add records to MeiliSearch
    // Explicitly specify the primary key to avoid MeiliSearch inference error
    // MeiliSearch requires objectID to be alphanumeric, hyphens, or underscores only.
    // We'll fix any invalid objectIDs by replacing invalid chars with underscores.
    const fixedRecords = targetRecords.map((rec) => ({
        ...rec,
        objectID: String(rec.objectID)
            .replace(/[^a-zA-Z0-9_-]/g, "_")
            .slice(0, 511)
    }));
    const { taskUid } = await meiliIndex.addDocuments(fixedRecords, {
        primaryKey: "objectID"
    });

    // Poll the MeiliSearch task status in a loop and throw if it fails
    let task;
    for (let i = 0; i < 60; ++i) {
        // up to ~60s
        task = await meiliClient.tasks.getTask(taskUid);
        if (task.status === "succeeded") {
            break;
        }
        if (task.status === "failed" || task.status === "canceled") {
            return NextResponse.json(
                {
                    error: `MeiliSearch reindex failed (taskUid: ${taskUid}): status=${task.status}`,
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
                error: `MeiliSearch reindex did not succeed in time (taskUid: ${taskUid}), last status: ${task?.status}`,
                details: task?.error
            },
            { status: 500 }
        );
    }

    return NextResponse.json({
        added: targetRecords.length,
        updated: 0,
        deleted: 0,
        unindexable: tooLarge.length,
        meiliTaskUid: taskUid
    });
}
