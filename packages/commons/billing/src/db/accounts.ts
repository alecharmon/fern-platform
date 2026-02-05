import { getClient } from "@fern-platform/supabase";
import { err, ok, type Result } from "neverthrow";

import { type BillingError, billingError } from "../errors";
import type { OrgBillingAccount, OrgBillingAccountInsert } from "./types";

/**
 * Get billing account by org ID.
 */
export async function getOrgBillingAccount(orgId: string): Promise<Result<OrgBillingAccount | null, BillingError>> {
    try {
        const client = getClient();
        const { data, error } = await client.from("org_billing_account").select("*").eq("org_id", orgId).maybeSingle();

        if (error) {
            return err(billingError("QUERY_FAILED", `Failed to get billing account: ${error.message}`, error));
        }

        return ok(data);
    } catch (e) {
        return err(billingError("QUERY_FAILED", "Failed to get billing account", e));
    }
}

/**
 * Get billing account by Stripe customer ID.
 */
export async function getOrgBillingAccountByCustomerId(
    stripeCustomerId: string
): Promise<Result<OrgBillingAccount | null, BillingError>> {
    try {
        const client = getClient();
        const { data, error } = await client
            .from("org_billing_account")
            .select("*")
            .eq("stripe_customer_id", stripeCustomerId)
            .maybeSingle();

        if (error) {
            return err(billingError("QUERY_FAILED", `Failed to get billing account: ${error.message}`, error));
        }

        return ok(data);
    } catch (e) {
        return err(billingError("QUERY_FAILED", "Failed to get billing account", e));
    }
}

/**
 * Create or update billing account.
 */
export async function upsertOrgBillingAccount(
    account: OrgBillingAccountInsert
): Promise<Result<OrgBillingAccount, BillingError>> {
    try {
        const client = getClient();
        const { data, error } = await client
            .from("org_billing_account")
            .upsert(account, { onConflict: "org_id" })
            .select()
            .single();

        if (error) {
            return err(billingError("QUERY_FAILED", `Failed to upsert billing account: ${error.message}`, error));
        }

        return ok(data);
    } catch (e) {
        return err(billingError("QUERY_FAILED", "Failed to upsert billing account", e));
    }
}
