import { NextRequest, NextResponse } from "next/server";

import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { getDocsDomainEdge } from "@fern-api/docs-server/xfernhost/edge";

import { JobManager, createJobStatusResponse } from "@/jobs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (isLocal() || isSelfHosted()) {
    return NextResponse.json(
      "turbopuffer status check is not accessible in local preview mode",
      { status: 400 }
    );
  }

  const jobId = req.nextUrl.searchParams.get("job_id");

  if (!jobId) {
    return NextResponse.json(
      { error: "job_id parameter is required" },
      { status: 400 }
    );
  }

  const domain = getDocsDomainEdge(req);
  const job = await JobManager.getJobStatus(domain);
  return createJobStatusResponse(job);
}
