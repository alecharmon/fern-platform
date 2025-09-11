import { NextRequest, NextResponse } from "next/server";

import { getFaiOrigin } from "@fern-api/docs-server/env-variables";
import { isLocal } from "@fern-api/docs-server/isLocal";
import { isSelfHosted } from "@fern-api/docs-server/isSelfHosted";
import { FernAIClient } from "@fern-api/fai-sdk";

export async function GET(req: NextRequest): Promise<NextResponse> {
  console.log("CHECK REINDEX STATUS");

  if (isLocal() || isSelfHosted()) {
    return NextResponse.json(
      "turbopuffer status check is not accessible in local preview mode",
      { status: 400 }
    );
  }

  // Get job_id from query parameters
  const jobId = req.nextUrl.searchParams.get("job_id");

  if (!jobId) {
    return NextResponse.json(
      { error: "job_id parameter is required" },
      { status: 400 }
    );
  }

  try {
    const faiClient = new FernAIClient({
      baseUrl: getFaiOrigin(),
    });

    const statusResponse = await faiClient.index.getJobStatus(jobId);
    const { status, success, error } = statusResponse;

    return NextResponse.json(
      {
        job_id: jobId,
        status,
        success,
        error,
        completed: status === "completed",
        failed: status === "failed",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[turbopuffer-status] ${JSON.stringify(error)}`);

    return NextResponse.json(
      {
        error: `Failed to get job status: ${String(error)}`,
        job_id: jobId,
        status: "error",
      },
      { status: 500 }
    );
  }
}
