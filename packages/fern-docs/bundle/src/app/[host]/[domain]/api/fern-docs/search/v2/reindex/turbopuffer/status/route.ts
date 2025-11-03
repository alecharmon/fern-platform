import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { type NextRequest, NextResponse } from "next/server";

import { createJobStatusResponse } from "@/jobs";
import { getMessageStatus } from "@/server/queue";

export async function GET(req: NextRequest): Promise<NextResponse> {
    if (isLocal() || isSelfHosted()) {
        return NextResponse.json("turbopuffer status check is not accessible in local preview mode", { status: 400 });
    }

    const jobId = req.nextUrl.searchParams.get("job_id");

    if (!jobId) {
        return NextResponse.json({ error: "job_id parameter is required" }, { status: 400 });
    }

    const status = await getMessageStatus(jobId);
    return createJobStatusResponse(jobId, status);
}
