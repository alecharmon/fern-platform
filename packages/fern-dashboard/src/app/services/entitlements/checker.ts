import "server-only";

import { createEntitlementsChecker, createUsageProvider, type EntitlementsChecker } from "@fern-platform/entitlements";

import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import { getOrganizationById } from "@/app/services/auth0/management";
import { Auth0OrgID, Auth0OrgName } from "@/app/services/auth0/types";
import getDocsSitesForOrg from "@/app/services/dal/fdr/getDocsSitesForOrg";
import { fernCliConfig } from "@/utils/fernCliConfig";

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

async function countCustomDomains(orgId: string): Promise<number> {
    try {
        const session = await getCurrentSessionOrThrow();
        const org = await getOrganizationById(Auth0OrgID(orgId));
        const response = await getDocsSitesForOrg({
            token: session.accessToken,
            orgName: Auth0OrgName(org.name)
        });
        if (!response.ok) {
            return 0;
        }
        const fernDomainSuffix = `.${fernCliConfig.docsDomain}`;
        return response.docsSites.flatMap((site) => site.urls).filter((url) => !url.domain.endsWith(fernDomainSuffix))
            .length;
    } catch {
        return 0;
    }
}

async function countAdditionalCustomDomains(_orgId: string): Promise<number> {
    // TODO: Implement tracking for additional custom domain usage.
    // For now, return 0 since addon usage tracking is not yet wired up.
    return 0;
}

let checker: EntitlementsChecker | undefined;

export function getEntitlementsChecker(): EntitlementsChecker {
    if (checker) {
        return checker;
    }

    checker = createEntitlementsChecker({
        usageProvider: createUsageProvider({
            docs_sites: countDocsSites,
            number_of_custom_domains: countCustomDomains,
            additional_custom_domains: countAdditionalCustomDomains
        })
    });

    return checker;
}
