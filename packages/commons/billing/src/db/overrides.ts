import { getClient } from "@fern-platform/supabase";
import { err, ok, type Result } from "neverthrow";
import { type BillingError, billingError } from "../errors";
import type { OrgBillingOverride, OrgBillingOverrideInsert } from "./types";

/**
 * Create a billing override for an organization.
 */
export async function createBillingOverride(
    override: OrgBillingOverrideInsert
): Promise<Result<OrgBillingOverride, BillingError>> {
    const client = getClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated Supabase types
    const { data, error } = await (client as any).from("org_billing_override").insert(override).select().single();

    if (error) {
        return err(billingError("QUERY_FAILED", `Failed to create billing override: ${error.message}`, error));
    }

    return ok(data as OrgBillingOverride);
}

/**
 * Get active (non-expired, non-revoked) overrides for an org.
 * Active means: start_date <= now AND (end_date IS NULL OR end_date > now) AND revoked_at IS NULL
 */
export async function getActiveOverrides(orgId: string): Promise<Result<OrgBillingOverride[], BillingError>> {
    const client = getClient();
    const now = new Date().toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated Supabase types
    const { data, error } = await (client as any)
        .from("org_billing_override")
        .select("*")
        .eq("org_id", orgId)
        .is("revoked_at", null)
        .lte("start_date", now)
        .or(`end_date.is.null,end_date.gt.${now}`);

    if (error) {
        return err(billingError("QUERY_FAILED", `Failed to get active overrides: ${error.message}`, error));
    }

    return ok((data ?? []) as OrgBillingOverride[]);
}

/**
 * Get all overrides (including expired/revoked) for audit history.
 */
export async function getOverrideHistory(orgId: string): Promise<Result<OrgBillingOverride[], BillingError>> {
    const client = getClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated Supabase types
    const { data, error } = await (client as any)
        .from("org_billing_override")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

    if (error) {
        return err(billingError("QUERY_FAILED", `Failed to get override history: ${error.message}`, error));
    }

    return ok((data ?? []) as OrgBillingOverride[]);
}

/**
 * Revoke a billing override (soft delete by setting revoked_at).
 */
export async function revokeBillingOverride(overrideId: string): Promise<Result<OrgBillingOverride, BillingError>> {
    const client = getClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated Supabase types
    const { data, error } = await (client as any)
        .from("org_billing_override")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", overrideId)
        .select()
        .single();

    if (error) {
        return err(billingError("QUERY_FAILED", `Failed to revoke billing override: ${error.message}`, error));
    }

    return ok(data as OrgBillingOverride);
}
