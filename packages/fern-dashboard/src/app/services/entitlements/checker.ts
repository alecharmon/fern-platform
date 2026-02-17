import "server-only";

import { getBillingPlan } from "@fern-platform/billing";
import {
    createEntitlementsChecker,
    createUsageCache,
    type EntitlementsChecker,
    type UsageProvider
} from "@fern-platform/entitlements";

import { getAuth0ManagementClient } from "@/app/services/auth0/management";

const FERN_EMAIL_DOMAIN = "@buildwithfern.com";

async function countOrgSeats(orgId: string): Promise<number> {
    const auth0 = getAuth0ManagementClient();
    let count = 0;
    let page = 0;
    const perPage = 100;

    while (true) {
        const { data } = await auth0.organizations.getMembers({
            id: orgId,
            page,
            per_page: perPage,
            fields: "user_id,email"
        });
        count += data.filter((m) => !m.email?.endsWith(FERN_EMAIL_DOMAIN)).length;
        page++;
        if (data.length < perPage) {
            break;
        }
    }

    return count;
}

const dashboardUsageProvider: UsageProvider = {
    getCurrentUsage: async (orgId, key) => {
        switch (key) {
            case "seats":
                return countOrgSeats(orgId);
            case "docs_sites":
                // TODO: wire up to actual docs site count
                return 0;
            default:
                return 0;
        }
    }
};

let checker: EntitlementsChecker | undefined;

export function getEntitlementsChecker(): EntitlementsChecker {
    if (checker) {
        return checker;
    }

    checker = createEntitlementsChecker({
        getActiveSkus: async (orgId) => {
            const result = await getBillingPlan(orgId);
            if (result.isErr() || result.value == null) {
                return ["plan_free"];
            }
            return result.value.products.map((p) => p.sku);
        },
        usageProvider: dashboardUsageProvider,
        usageCache: createUsageCache()
    });

    return checker;
}
