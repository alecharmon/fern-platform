import { cacheLife, cacheTag } from "next/cache";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getAppInstallationByTeamId } from "@/app/services/postman/repository";
import { getVenusClient } from "@/app/services/venus/getVenusClient";

export interface PostmanConnectionInfo {
    teamId: string;
    teamName: string | null;
}

/**
 * Cached version of getPostmanConnection.
 * Returns the Postman team connection info for an org, or null if not connected.
 *
 * NOTE: The token is included as a parameter because:
 * - "use cache" functions cannot call dynamic APIs like cookies()/headers()
 * - The Venus API requires an Auth0 org-scoped token for correct results
 * - The token becomes part of the cache key, so the cache is per-user-session
 */
export async function cachedGetPostmanConnection({
    orgName,
    token
}: {
    orgName: Auth0OrgName;
    token: string;
}): Promise<PostmanConnectionInfo | null> {
    "use cache";
    cacheLife("minutes");
    cacheTag(`postman-connection:${orgName}`);

    const venus = getVenusClient({ token });
    const orgResponse = await venus.organization.get(orgName);

    if (!orgResponse.ok || !orgResponse.body.postmanTeamId) {
        return null;
    }

    const teamId = orgResponse.body.postmanTeamId;

    const appInstallation = await getAppInstallationByTeamId(teamId);
    const teamName = appInstallation?.team_name ?? null;

    return {
        teamId,
        teamName
    };
}
