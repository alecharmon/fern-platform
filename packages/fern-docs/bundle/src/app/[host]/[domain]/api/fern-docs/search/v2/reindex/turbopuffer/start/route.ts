import { uncachedGetDocsUrlMetadata } from "@fern-api/docs-server/getDocsUrlMetadata";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { loadWithUrl } from "@fern-api/docs-server/loadWithUrl";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { withoutStaging } from "@fern-api/docs-utils";
import { kv } from "@vercel/kv";
import { type NextRequest, NextResponse } from "next/server";
import { createJobResponse } from "@/jobs";
import { queueTurbopufferStartReindex } from "@/server/queue-reindex";

export const maxDuration = 800; // 13 minutes

export async function GET(req: NextRequest): Promise<NextResponse> {
    if (isLocal() || isSelfHosted()) {
        return NextResponse.json("turbopuffer is not accessible in local preview mode", { status: 400 });
    }

    const host = req.nextUrl.host;
    const domain = getDocsDomainEdge(req);

    let faiCallbackURL: string | undefined = undefined;
    const metadata = await uncachedGetDocsUrlMetadata(domain);
    // TODO(Sahil): Change the enableAlgoliaOnPreview name to be more descriptive.
    // Right now it's not clear that this can be either a preview domain or a regular domain (set in publishDocs.ts)
    if (metadata?.enableAlgoliaOnPreview) {
        faiCallbackURL = process.env.FAI_SERVER_URL
            ? `${process.env.FAI_SERVER_URL}/settings/reindex-preview-callback`
            : `https://fai.buildwithfern.com/settings/reindex-preview-callback`;
    }

    const deleteExisting = req.nextUrl.searchParams.get("deleteExisting") !== "false";

    const docs = await loadWithUrl(domain);
    const { basePath } = docs.baseUrl;

    const messageId = await queueTurbopufferStartReindex({
        host,
        domain: withoutStaging(domain),
        basepath: basePath,
        deleteExisting,
        timeoutSeconds: maxDuration,
        callback: faiCallbackURL
    });

    if (!messageId) {
        return NextResponse.json("Failed to queue turbopuffer reindex", {
            status: 400
        });
    }

    await kv.hset(domain, {
        tpuf_job: {
            status: "in_progress"
        }
    });

    return createJobResponse(messageId, "in_progress");
}
