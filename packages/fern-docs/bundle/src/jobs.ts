import { NextResponse } from "next/server";

import { kv } from "@vercel/kv";

interface JobStatus {
  id: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  created_at: number;
  started_at?: number;
  completed_at?: number;
  error?: string;
  result?: any;
}

export async function createJob(
  domain: string,
  messageId: string
): Promise<string> {
  const job: JobStatus = {
    id: messageId,
    status: "in_progress",
    created_at: Date.now(),
  };

  await kv.hset(domain, { [`tpuf_job`]: job });
  return job.id;
}

export async function getJobStatus(
  domain: string
): Promise<JobStatus | undefined> {
  const job = await kv.hget<JobStatus>(domain, `tpuf_job`);
  return job ?? undefined;
}

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
