import { getClient } from "@fern-platform/supabase";
import { err, ok, type Result } from "neverthrow";
import { insertActivityLog } from "./activity-log.js";
import { calculateCredits } from "./credits.js";
import { type ActivityLogError, activityLogError } from "./errors.js";
import type { ActivityLog, ActivityLogEntry, ActivityLogType, Duration, OrgFernCreditUsage } from "./types.js";

export async function insertCreditUsage(
    orgId: string,
    site: string,
    type: ActivityLogType,
    creditsUsed: number,
    eventId: string
): Promise<Result<OrgFernCreditUsage, ActivityLogError>> {
    const client = getClient();
    const { data, error } = await client
        .from("org_fern_credit_usage")
        .insert({
            org_id: orgId,
            site,
            type,
            credits_used: creditsUsed,
            event_id: eventId
        })
        .select()
        .single();

    if (error || !data) {
        return err(activityLogError("INSERT_FAILED", `Failed to insert credit usage: ${error?.message}`, error));
    }

    return ok(data as OrgFernCreditUsage);
}

export async function getCreditUsage(
    orgId: string,
    opts?: { limit?: number; offset?: number; site?: string; type?: ActivityLogType }
): Promise<Result<OrgFernCreditUsage[], ActivityLogError>> {
    const client = getClient();
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;

    let query = client.from("org_fern_credit_usage").select("*").eq("org_id", orgId);

    if (opts?.type) {
        query = query.eq("type", opts.type);
    }
    if (opts?.site) {
        query = query.eq("site", opts.site);
    }

    const { data, error } = await query.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    if (error) {
        return err(activityLogError("QUERY_FAILED", `Failed to get credit usage: ${error.message}`, error));
    }

    return ok((data ?? []) as OrgFernCreditUsage[]);
}

export async function sumCreditUsage(
    orgId: string,
    since: string,
    until: string,
    opts?: { site?: string; type?: ActivityLogType }
): Promise<Result<number, ActivityLogError>> {
    const client = getClient();

    let query = client.from("org_fern_credit_usage").select("credits_used").eq("org_id", orgId);

    if (opts?.type) {
        query = query.eq("type", opts.type);
    }
    if (opts?.site) {
        query = query.eq("site", opts.site);
    }

    const { data, error } = await query.gte("created_at", since).lte("created_at", until);

    if (error) {
        return err(activityLogError("QUERY_FAILED", `Failed to sum credit usage: ${error.message}`, error));
    }

    const total = (data ?? []).reduce((sum, row) => sum + (row as { credits_used: number }).credits_used, 0);
    return ok(total);
}

export async function logActivityWithCredits(
    orgId: string,
    site: string,
    entry: ActivityLogEntry,
    opts?: { ttl?: Duration }
): Promise<Result<{ event: ActivityLog; credit: OrgFernCreditUsage }, ActivityLogError>> {
    const eventResult = await insertActivityLog(orgId, site, entry, opts);
    if (eventResult.isErr()) {
        return err(eventResult.error);
    }

    const credits = calculateCredits(entry);
    const creditResult = await insertCreditUsage(orgId, site, entry.type, credits, eventResult.value.id);
    if (creditResult.isErr()) {
        return err(creditResult.error);
    }

    return ok({ event: eventResult.value, credit: creditResult.value });
}
