import { ENTITLEMENT_DEFINITIONS, type EntitlementCheckResult, type EntitlementKey } from "@fern-platform/entitlements";

import * as auth0Management from "@/app/services/auth0/management";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getEntitlementsChecker } from "@/app/services/entitlements/checker";

export interface OrgEntitlementsResponse {
    entitlements: Record<EntitlementKey, EntitlementCheckResult>;
    isFernEmployee: boolean;
}

export default async function getOrgEntitlements({
    orgName,
    permissions
}: {
    orgName: Auth0OrgName;
    permissions: string[];
}): Promise<OrgEntitlementsResponse> {
    const isFernEmployeeUser = auth0Management.isFernEmployee(permissions);

    const orgId = await auth0Management.getOrgIdFromName(orgName);
    const checker = getEntitlementsChecker();

    const keys = Object.keys(ENTITLEMENT_DEFINITIONS) as EntitlementKey[];
    const results = await Promise.all(keys.map((key) => checker.check(orgId, key)));

    const entitlements = Object.fromEntries(keys.map((key, i) => [key, results[i]])) as Record<
        EntitlementKey,
        EntitlementCheckResult
    >;

    return {
        entitlements,
        isFernEmployee: isFernEmployeeUser
    };
}
