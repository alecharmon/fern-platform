import { NextResponse } from "next/server";

import { kv } from "@vercel/kv";
import { randomUUID } from "crypto";

interface JobStatus {
  id: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  created_at: number;
  started_at?: number;
  completed_at?: number;
  error?: string;
  result?: any;
}

export class JobManager {
  static async createJob(domain: string): Promise<string> {
    const job: JobStatus = {
      id: randomUUID(),
      status: "pending",
      created_at: Date.now(),
    };

    await kv.hset(domain, { [`tpuf_job`]: job });
    return job.id;
  }

  static async executeJob<T>(
    domain: string,
    task: () => Promise<T>
  ): Promise<void> {
    const job = await kv.hget<JobStatus>(domain, `tpuf_job`);
    if (!job) {
      throw new Error("Job not found");
    }

    job.status = "in_progress";
    job.started_at = Date.now();
    await kv.hset(domain, { [`tpuf_job`]: job });

    try {
      const result = await task();
      job.status = "completed";
      job.completed_at = Date.now();
      job.result = result;
    } catch (error) {
      job.status = "failed";
      job.completed_at = Date.now();
      job.error = error instanceof Error ? error.message : String(error);
    }

    await kv.hset(domain, { [`tpuf_job`]: job });
  }

  static async getJobStatus(domain: string): Promise<JobStatus | undefined> {
    const job = await kv.hget<JobStatus>(domain, `tpuf_job`);
    return job ?? undefined;
  }

  static async getJob(domain: string): Promise<JobStatus | undefined> {
    const job = await kv.hget<JobStatus>(domain, `tpuf_job`);
    return job ?? undefined;
  }
}

export function createJobResponse(
  message: string = "Job created successfully",
  job_id: string
) {
  return NextResponse.json({
    message,
    job_id,
  });
}

export function createJobStatusResponse(job: JobStatus | undefined) {
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    completed: job.status === "completed",
    failed: job.status === "failed",
    created_at: job.created_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
    error: job.error,
    result: job.result,
  });
}
