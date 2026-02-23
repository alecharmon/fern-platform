import "server-only";

import type { DocsSite } from "@fern-api/fdr-sdk/orpc-client";
import { cache } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getOrpcFdrClient } from "@/app/services/fdr/getFdrClient";

export type GetDocsSitesForOrgError = "UNKNOWN_ERROR" | "ORG_NOT_FOUND";

const getDocsSitesForOrg = cache(
    async ({
        token,
        orgName
    }: {
        token: string;
        orgName: Auth0OrgName;
    }): Promise<
        | { ok: true; docsSites: DocsSite[] }
        | {
              ok: false;
              error: { type: GetDocsSitesForOrgError; message?: string };
          }
    > => {
        console.debug(`[getDocsSitesForOrg] Starting request for organization: ${orgName}`);
        const fdr = getOrpcFdrClient({ token });

        try {
            const response = await fdr.dashboard.getDocsSitesForOrg({
                // fdr uses org name (not id) as the org identifier
                orgId: orgName
            });
            console.debug(
                `[getDocsSitesForOrg] Successfully fetched ${response.docsSites.length} docs sites for ${orgName}`
            );
            return { ok: true, docsSites: response.docsSites };
        } catch (error) {
            console.error(`[getDocsSitesForOrg] Exception while fetching docs sites for ${orgName}:`, error);
            return {
                ok: false,
                error: {
                    type: "UNKNOWN_ERROR",
                    message: error instanceof Error ? error.message : "Unknown error"
                }
            };
        }
    }
);

export default getDocsSitesForOrg;
