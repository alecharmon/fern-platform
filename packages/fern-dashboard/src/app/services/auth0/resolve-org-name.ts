import { getOrganizationById } from "./management";
import { Auth0OrgID } from "./types";

/**
 * Resolve a human-readable org name from an Auth0 org ID.
 * Falls back to the raw ID if the lookup fails.
 */
export async function resolveOrgName(orgId: string): Promise<string> {
    try {
        const org = await getOrganizationById(Auth0OrgID(orgId));
        return org.display_name ?? org.name ?? orgId;
    } catch {
        return orgId;
    }
}
