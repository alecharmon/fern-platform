import "server-only";

import { getBillingPlan } from "@fern-platform/billing";
import {
    createEntitlementsChecker,
    createUsageCache,
    type EntitlementsChecker,
    type UsageProvider
} from "@fern-platform/entitlements";

import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import { getAuth0ManagementClient, getOrganizationById } from "@/app/services/auth0/management";
import { Auth0OrgID, Auth0OrgName } from "@/app/services/auth0/types";
import getDocsSitesForOrg from "@/app/services/dal/fdr/getDocsSitesForOrg";

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

async function countDocsSites(orgId: string): Promise<number> {
    try {
        const session = await getCurrentSessionOrThrow();
        const org = await getOrganizationById(Auth0OrgID(orgId));
        const response = await getDocsSitesForOrg({
            token: session.accessToken,
            orgName: Auth0OrgName(org.name)
        });
        return response.ok ? response.docsSites.length : 0;
    } catch {
        return 0;
    }
}

const dashboardUsageProvider: UsageProvider = {
    getCurrentUsage: async (orgId, key) => {
        switch (key) {
            case "seats":
                return countOrgSeats(orgId);
            case "docs_sites":
                return countDocsSites(orgId);
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
            // Repeat each SKU by its qty so that addons with per-unit grants
            // (e.g. addon_extra_seats with limit: 1) sum correctly.
            return result.value.products.flatMap((p) => Array.from({ length: p.qty }, () => p.sku));
        },
        usageProvider: dashboardUsageProvider,
        usageCache: createUsageCache()
    });

    return checker;
}
