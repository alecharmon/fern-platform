import { err, ok, type Result } from "neverthrow";
import { getOrgBillingAccount, upsertOrgBillingAccount } from "../db/accounts";
import type { OrgBillingAccount } from "../db/types";
import { type BillingError, billingError } from "../errors";
import { getStripeClient } from "../stripe/client";

/**
 * Ensure an org has a billing account with a Stripe customer.
 *
 * If the org already has a billing account, returns it.
 * Otherwise, creates a Stripe customer and upserts the billing account.
 *
 * This is a backfill method — org creation should create billing accounts upfront.
 */
export async function ensureBillingAccount(
    orgId: string,
    opts?: { orgName?: string }
): Promise<Result<OrgBillingAccount, BillingError>> {
    const existing = await getOrgBillingAccount(orgId);
    if (existing.isErr()) {
        return err(existing.error);
    }

    if (existing.value != null) {
        return ok(existing.value);
    }

    // Create Stripe customer
    try {
        const stripe = getStripeClient();
        const customer = await stripe.customers.create({
            name: opts?.orgName ?? orgId,
            metadata: { org_id: orgId }
        });

        return upsertOrgBillingAccount({
            org_id: orgId,
            stripe_customer_id: customer.id
        });
    } catch (e) {
        return err(
            billingError(
                "STRIPE_ERROR",
                `Failed to create Stripe customer for org ${orgId}: ${e instanceof Error ? e.message : String(e)}`,
                e
            )
        );
    }
}
