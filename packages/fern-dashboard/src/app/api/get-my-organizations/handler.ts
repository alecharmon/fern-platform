import * as auth0Management from "@/app/services/auth0/management";
import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";

export default async function getMyOrganizations(
    userId: Auth0UserID,
    options?: { orgName?: Auth0OrgName; permissions?: string[] }
) {
    const orgs = await auth0Management.getMyOrganizations(userId);

    // If the user is a super user viewing an org they don't belong to, include it
    if (options?.orgName && options.permissions && auth0Management.isSuperUser(options.permissions)) {
        const alreadyIncluded = orgs.some((org) => org.name === options.orgName);
        if (!alreadyIncluded) {
            try {
                const org = await auth0Management.getOrganization(options.orgName);
                orgs.push(org);
            } catch (error) {
                console.error(`[getMyOrganizations] Failed to fetch org ${options.orgName} for super user:`, error);
            }
        }
    }

    return orgs;
}
