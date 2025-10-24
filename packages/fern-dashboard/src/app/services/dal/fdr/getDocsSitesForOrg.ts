import "server-only";

import { FdrAPI } from "@fern-api/fdr-sdk/client/types";
import { cache } from "react";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import { getFdrClient } from "@/app/services/fdr/getFdrClient";

import { doesOrgExist } from "../../auth0/management";

export type GetDocsSitesForOrgError = FdrAPI.dashboard.getDocsSitesForOrg.Error | "UNKNOWN_ERROR" | "ORG_NOT_FOUND";

const getDocsSitesForOrg = cache(
    async ({
        token,
        orgName
    }: {
        token: string;
        orgName: Auth0OrgName;
    }): Promise<
        | { ok: true; docsSites: FdrAPI.dashboard.DocsSite[] }
        | {
              ok: false;
              error: { type: GetDocsSitesForOrgError; message?: string };
          }
    > => {
        console.debug(`[getDocsSitesForOrg] Starting request for organization: ${orgName}`);
        const fdr = getFdrClient({ token });

        const orgExists = await doesOrgExist(orgName);
        if (!orgExists) {
            console.warn(`[getDocsSitesForOrg] Organization not found: ${orgName}`);
            return { ok: false, error: { type: "ORG_NOT_FOUND" } };
        }
        console.debug(`[getDocsSitesForOrg] Organization ${orgName} exists, fetching docs sites from FDR`);

        try {
            const response = await fdr.dashboard.getDocsSitesForOrg({
                // fdr uses org name (not id) as the org identifier
                orgId: FdrAPI.OrgId(orgName)
            });
            if (!response.ok) {
                console.error(
                    `[getDocsSitesForOrg] FDR request failed for ${orgName}:`,
                    JSON.stringify(response.error, null, 2)
                );
                if (response.error.error) {
                    return {
                        ok: false,
                        error: { type: response.error.error as GetDocsSitesForOrgError }
                    };
                }
                return {
                    ok: false,
                    error: {
                        type: "UNKNOWN_ERROR",
                        message: response.error.content.reason
                    }
                };
            }
            console.debug(
                `[getDocsSitesForOrg] Successfully fetched ${response.body.docsSites.length} docs sites for ${orgName}`
            );
            return { ok: true, docsSites: response.body.docsSites };
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
