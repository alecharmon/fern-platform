import { type BillingPlan, getBillingPlan, PLAN_CONFIGS } from "@fern-platform/billing";

import { getOrgIdFromName } from "@/app/services/auth0/management";
import type { Auth0OrgName } from "@/app/services/auth0/types";

import { PlanBadgeButton } from "./PlanBadgeButton";

function getActivePlanName(billingPlan: BillingPlan): string {
    if (billingPlan.planSku != null) {
        for (const plan of PLAN_CONFIGS) {
            if (plan.planSkuMatcher(billingPlan.planSku)) {
                return plan.name;
            }
        }
    }
    const tierMatch = PLAN_CONFIGS.find((p) => p.tier === billingPlan.tier);
    return tierMatch?.name ?? "Hobby";
}

interface PlanBadgeProps {
    orgName: Auth0OrgName;
}

export async function PlanBadge({ orgName }: PlanBadgeProps) {
    try {
        const orgId = await getOrgIdFromName(orgName);
        const result = await getBillingPlan(orgId);

        const planName = result.isOk() && result.value != null ? getActivePlanName(result.value) : "Hobby";

        return <PlanBadgeButton planName={planName} href={`/${orgName}/billing`} />;
    } catch {
        return null;
    }
}
