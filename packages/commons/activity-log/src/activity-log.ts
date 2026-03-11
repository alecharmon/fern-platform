import { getClient, type Json } from "@fern-platform/supabase";
import { err, ok, type Result } from "neverthrow";
import { type ActivityLogError, activityLogError } from "./errors.js";
import type { ActivityLog, ActivityLogEntry, ActivityLogType, Duration } from "./types.js";

function computeExpiresAt(ttl?: Duration): string | null {
    if (!ttl) {
        return null;
    }
    const ms = (ttl.days ?? 0) * 24 * 60 * 60 * 1000 + (ttl.hours ?? 0) * 60 * 60 * 1000;
    if (ms <= 0) {
        return null;
    }
    return new Date(Date.now() + ms).toISOString();
}

export async function insertActivityLog(
    orgId: string,
    site: string,
    entry: ActivityLogEntry,
    opts?: { ttl?: Duration }
): Promise<Result<ActivityLog, ActivityLogError>> {
    const client = getClient();
    const { data, error } = await client
        .from("org_activity_log")
        .insert({
            org_id: orgId,
            site,
            type: entry.type,
            metadata: entry.metadata as unknown as Json,
            expires_at: computeExpiresAt(opts?.ttl)
        })
        .select()
        .single();

    if (error || !data) {
        return err(activityLogError("INSERT_FAILED", `Failed to insert activity log: ${error?.message}`, error));
    }

    return ok(data as ActivityLog);
}

export async function getActivityLogs(
    orgId: string,
    opts?: { limit?: number; offset?: number; type?: ActivityLogType; site?: string }
): Promise<Result<ActivityLog[], ActivityLogError>> {
    const client = getClient();
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;

    let query = client.from("org_activity_log").select("*").eq("org_id", orgId);

    if (opts?.type) {
        query = query.eq("type", opts.type);
    }
    if (opts?.site) {
        query = query.eq("site", opts.site);
    }

    const { data, error } = await query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    if (error) {
        return err(activityLogError("QUERY_FAILED", `Failed to get activity logs: ${error.message}`, error));
    }

    return ok((data ?? []) as ActivityLog[]);
}

export async function getActivityLog(eventId: string): Promise<Result<ActivityLog | null, ActivityLogError>> {
    const client = getClient();
    const { data, error } = await client.from("org_activity_log").select("*").eq("id", eventId).maybeSingle();

    if (error) {
        return err(activityLogError("QUERY_FAILED", `Failed to get activity log: ${error.message}`, error));
    }

    return ok(data as ActivityLog | null);
}
