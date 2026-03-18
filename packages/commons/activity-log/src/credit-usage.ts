import { getClient, type Json } from "@fern-platform/supabase";
import { err, ok, type Result } from "neverthrow";
import { insertActivityLog } from "./activity-log.js";
import { calculateCredits } from "./credits.js";
import { type ActivityLogError, activityLogError } from "./errors.js";
import type { ActivityLog, ActivityLogEntry, ActivityLogType, Duration, OrgFernCreditUsage } from "./types.js";

export type EntitlementCheckFn = (orgId: string, key: string) => Promise<EntitlementCheckResult>;

type EntitlementCheckResult =
    | { entitled: true; type: "metered"; allowance: number; used: number; remaining: number; overagePolicy: string }
    | { entitled: false; reason: string; limit?: number; used?: number };

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
    if (entry.type === "fern_writer" && entry.metadata.devin_session_id) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const client = getClient();

        const { data: existing, error: lookupError } = await client
            .from("org_activity_log")
            .select("*")
            .eq("org_id", orgId)
            .eq("type", "fern_writer")
            .eq("metadata->>devin_session_id", entry.metadata.devin_session_id)
            .gte("created_at", thirtyDaysAgo)
            .maybeSingle();

        if (lookupError) {
            return err(
                activityLogError(
                    "QUERY_FAILED",
                    `Failed to look up existing session: ${lookupError.message}`,
                    lookupError
                )
            );
        }

        if (existing) {
            const { error: updateError } = await client
                .from("org_activity_log")
                .update({ metadata: entry.metadata as unknown as Json })
                .eq("id", existing.id);

            if (updateError) {
                return err(
                    activityLogError(
                        "INSERT_FAILED",
                        `Failed to update activity log: ${updateError.message}`,
                        updateError
                    )
                );
            }

            const credits = calculateCredits(entry);

            const { data: creditRow, error: creditLookupError } = await client
                .from("org_fern_credit_usage")
                .select("*")
                .eq("event_id", existing.id)
                .single();

            if (creditLookupError || !creditRow) {
                return err(
                    activityLogError(
                        "QUERY_FAILED",
                        `Failed to find credit usage for event: ${creditLookupError?.message}`,
                        creditLookupError
                    )
                );
            }

            const { error: creditUpdateError } = await client
                .from("org_fern_credit_usage")
                .update({ credits_used: credits })
                .eq("id", (creditRow as OrgFernCreditUsage).id);

            if (creditUpdateError) {
                return err(
                    activityLogError(
                        "INSERT_FAILED",
                        `Failed to update credit usage: ${creditUpdateError.message}`,
                        creditUpdateError
                    )
                );
            }

            return ok({
                event: { ...existing, metadata: entry.metadata } as unknown as ActivityLog,
                credit: { ...(creditRow as OrgFernCreditUsage), credits_used: credits }
            });
        }
    }

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

export async function checkCreditAllowance(
    orgId: string,
    check: EntitlementCheckFn
): Promise<Result<{ allowed: boolean; used: number; limit: number }, ActivityLogError>> {
    try {
        const result = await check(orgId, "ai_credits");

        if (result.entitled) {
            return ok({ allowed: true, used: result.used, limit: result.allowance });
        }

        return ok({
            allowed: false,
            used: result.used ?? 0,
            limit: result.limit ?? 0
        });
    } catch (e) {
        return err(
            activityLogError(
                "QUERY_FAILED",
                `Failed to check credit allowance: ${e instanceof Error ? e.message : String(e)}`,
                e
            )
        );
    }
}
