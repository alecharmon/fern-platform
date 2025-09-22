import { NextResponse } from "next/server";

export function createJobResponse(
  job_id: string,
  status: "completed" | "failed" | "in_progress"
) {
  return NextResponse.json({
    job_id,
    status,
  });
}

export function createJobStatusResponse(
  jobId: string,
  status: "completed" | "failed" | "in_progress"
) {
  if (!status) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: jobId,
    status,
  });
}
