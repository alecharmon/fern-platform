import type { DashboardDocsSite } from "@fern-api/fdr-sdk/orpc-client";
import { cacheLife, cacheTag } from "next/cache";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getOrpcFdrClient } from "@/app/services/fdr/getFdrClient";

export type GetDocsSitesForOrgError = "UNKNOWN_ERROR" | "ORG_NOT_FOUND";

/**
 * Cached version of getDocsSitesForOrg.
 * The list of docs sites for an org changes rarely, so we cache for 5 minutes.
 *
 * NOTE: The token is included as a parameter because:
 * - "use cache" functions cannot call dynamic APIs like cookies()/headers()
 * - The FDR API requires an Auth0 org-scoped token for correct results
 * - The token becomes part of the cache key, so the cache is per-user-session,
 *   but JWTs are stable within a session window (~15-30 min), so tab switches
 *   still benefit from cache hits.
 */
export async function getCachedDocsSitesForOrg({ orgName, token }: { orgName: Auth0OrgName; token: string }): Promise<
    | { ok: true; docsSites: DashboardDocsSite[] }
    | {
          ok: false;
          error: { type: GetDocsSitesForOrgError; message?: string };
      }
> {
    "use cache";
    cacheLife("minutes");
    cacheTag(`docs-sites:${orgName}`);

    console.debug(`[getCachedDocsSitesForOrg] Fetching docs sites for org: ${orgName}`);
    const fdr = getOrpcFdrClient({ token });

    try {
        const response = await fdr.dashboard.getDocsSitesForOrg({
            orgId: orgName
        });
        console.debug(
            `[getCachedDocsSitesForOrg] Successfully fetched ${response.docsSites.length} docs sites for ${orgName}`
        );
        return { ok: true, docsSites: response.docsSites };
    } catch (error) {
        console.error(`[getCachedDocsSitesForOrg] Exception while fetching docs sites for ${orgName}:`, error);
        return {
            ok: false,
            error: {
                type: "UNKNOWN_ERROR",
                message: error instanceof Error ? error.message : "Unknown error"
            }
        };
    }
}
