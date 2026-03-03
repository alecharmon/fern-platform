"use server";

import { type BillingPlan, getBillingPlan, getOrgBillingAccount } from "@fern-platform/billing";
import { ENTITLEMENT_DEFINITIONS, type EntitlementCheckResult, type EntitlementKey } from "@fern-platform/entitlements";

import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import * as auth0Management from "@/app/services/auth0/management";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getEntitlementsChecker } from "@/app/services/entitlements/checker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BillingInfo {
    plan: BillingPlan | null;
    stripeCustomerId: string | null;
    stripeCustomerUrl: string | null;
}

export interface EntitlementInfo {
    key: EntitlementKey;
    result: EntitlementCheckResult;
}

export interface Auth0OrgInfo {
    orgId: string;
    orgName: string;
    displayName: string | undefined;
    auth0ManageUrl: string;
}

export interface SuperAdminData {
    billing: BillingInfo;
    entitlements: EntitlementInfo[];
    auth0Org: Auth0OrgInfo;
}

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function getSuperAdminData({
    orgName
}: {
    orgName: Auth0OrgName;
}): Promise<SuperAdminData | { error: string }> {
    const session = await getCurrentSessionOrThrow();

    if (!auth0Management.isSuperUser(session.permissions ?? [])) {
        return { error: "Unauthorized: super-user permission required" };
    }

    try {
        // Fetch org info
        const org = await auth0Management.getOrganization(orgName);
        if (org == null) {
            return { error: `Organization "${orgName}" not found` };
        }

        const orgId = org.id;
        const auth0Domain = process.env.AUTH0_DOMAIN ?? "fern-prod.us.auth0.com";
        const auth0Tenant = auth0Domain.split(".")[0];

        // Fetch billing info
        const [billingPlanResult, billingAccountResult] = await Promise.all([
            getBillingPlan(orgId),
            getOrgBillingAccount(orgId)
        ]);

        const billingPlan = billingPlanResult.isOk() ? billingPlanResult.value : null;
        const stripeCustomerId = billingAccountResult.isOk()
            ? (billingAccountResult.value?.stripe_customer_id ?? null)
            : null;
        const stripeCustomerUrl = stripeCustomerId
            ? `https://dashboard.stripe.com/customers/${stripeCustomerId}`
            : null;

        // Fetch entitlements
        const checker = getEntitlementsChecker();
        const keys = Object.keys(ENTITLEMENT_DEFINITIONS) as EntitlementKey[];
        const results = await Promise.all(keys.map((key) => checker.check(orgId, key)));
        const entitlements: EntitlementInfo[] = keys.map((key, i) => ({
            key,
            result: results[i]
        }));

        return {
            billing: {
                plan: billingPlan,
                stripeCustomerId,
                stripeCustomerUrl
            },
            entitlements,
            auth0Org: {
                orgId,
                orgName: org.name,
                displayName: org.display_name ?? undefined,
                auth0ManageUrl: `https://manage.auth0.com/dashboard/us/${auth0Tenant}/organizations/${orgId}/overview`
            }
        };
    } catch (error: unknown) {
        console.error("[getSuperAdminData] Error:", error);
        return { error: error instanceof Error ? error.message : "Failed to fetch super admin data" };
    }
}
