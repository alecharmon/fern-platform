import "server-only";

import { createEntitlementsChecker, createUsageProvider, type EntitlementsChecker } from "@fern-platform/entitlements";

import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import { getOrganizationById } from "@/app/services/auth0/management";
import { Auth0OrgID, Auth0OrgName } from "@/app/services/auth0/types";
import getDocsSitesForOrg from "@/app/services/dal/fdr/getDocsSitesForOrg";

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

let checker: EntitlementsChecker | undefined;

export function getEntitlementsChecker(): EntitlementsChecker {
    if (checker) {
        return checker;
    }

    checker = createEntitlementsChecker({
        usageProvider: createUsageProvider({
            docs_sites: countDocsSites
        })
    });

    return checker;
}
