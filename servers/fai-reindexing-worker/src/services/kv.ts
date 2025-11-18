import { kv } from "@vercel/kv";
import type { JobStatus } from "../types";

export async function setJobStatus(domain: string, status: JobStatus): Promise<void> {
    await kv.hset(domain, {
        tpuf_job: status
    });
}

export async function getJobStatus(domain: string): Promise<JobStatus | null> {
    const job = await kv.hget(domain, "tpuf_job");
    if (job && typeof job === "object" && "status" in job) {
        return job as JobStatus;
    }
    return null;
}
