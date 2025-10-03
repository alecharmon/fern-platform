import "server-only";

import { cache } from "react";

import { FdrAPI } from "@fern-api/fdr-sdk/client/types";

import { Auth0OrgName } from "@/app/services/auth0/types";
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
        const fdr = getFdrClient({ token });

        const orgExists = await doesOrgExist(orgName);
        if (!orgExists) {
            return { ok: false, error: { type: "ORG_NOT_FOUND" } };
        }

        try {
            const response = await fdr.dashboard.getDocsSitesForOrg({
                // fdr uses org name (not id) as the org identifier
                orgId: FdrAPI.OrgId(orgName)
            });
            if (!response.ok) {
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
            return { ok: true, docsSites: response.body.docsSites };
        } catch (error) {
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
