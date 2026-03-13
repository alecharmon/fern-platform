import { getOrgIdFromName } from "@/app/services/auth0/management";
import { Auth0OrgName } from "@/app/services/auth0/types";

/**
 * Resolves an org identifier to an Auth0 org ID (org_xxxx).
 * The Python credit client sends the org name from FDR metadata,
 * so we need to look up the Auth0 org ID before inserting into Supabase.
 */
export async function resolveToAuth0OrgId(orgIdentifier: string): Promise<string> {
    if (orgIdentifier.startsWith("org_")) {
        return orgIdentifier;
    }

    return await getOrgIdFromName(Auth0OrgName(orgIdentifier));
}
