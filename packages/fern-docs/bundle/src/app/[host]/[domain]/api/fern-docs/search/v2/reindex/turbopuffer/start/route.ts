import { NextRequest, NextResponse } from "next/server";

import { kv } from "@vercel/kv";

import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { loadWithUrl } from "@fern-api/docs-server/loadWithUrl";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";
import { withoutStaging } from "@fern-api/docs-utils";

import { createJobResponse } from "@/jobs";
import { queueTurbopufferStartReindex } from "@/server/queue-reindex";

export const maxDuration = 800; // 13 minutes

export async function GET(req: NextRequest): Promise<NextResponse> {
    if (isLocal() || isSelfHosted()) {
        return NextResponse.json("turbopuffer is not accessible in local preview mode", { status: 400 });
    }

    const host = req.nextUrl.host;
    const domain = getDocsDomainEdge(req);
    const deleteExisting = req.nextUrl.searchParams.get("deleteExisting") === "true";

    const docs = await loadWithUrl(domain);
    const { basePath } = docs.baseUrl;

    const messageId = await queueTurbopufferStartReindex(
        host,
        withoutStaging(domain),
        basePath,
        deleteExisting,
        maxDuration
    );

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
