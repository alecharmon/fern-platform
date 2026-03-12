import type { DashboardDocsSite, GetDocsSitesForOrgResponseSchema } from "@fern-api/fdr-sdk/orpc-client";
import { os } from "@orpc/server";
import * as z from "zod";

import type { FdrApplication } from "../../app";
import type { DocsSite as DocsV2DocsSite } from "../../db/docs/DocsV2Dao";

export function createDashboardRouter(app: FdrApplication) {
    const getDocsSitesForOrg = os
        .route({ method: "POST", path: "/get-docs-sites-for-org" })
        .input(z.custom<{ orgId: string }>())
        .output(z.custom<z.infer<typeof GetDocsSitesForOrgResponseSchema>>())
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: input.orgId
            });

            // 1. Get sites from the DocsSite table (tracks deployment status)
            const docsSiteRecords = await app.dao.docsSite().getDocsSitesForOrg(input.orgId);

            // 2. Get sites from the DocsV2 table (legacy, always considered "live")
            const docsV2Result = await app.dao.docsV2().listDocsSitesForOrg(input.orgId);

            // 3. Build a set of domain+basepath keys from DocsSite records
            const docsSiteKeys = new Set(docsSiteRecords.map((record) => `${record.domain}::${record.basepath}`));

            // 4. Convert DocsSite records into DashboardDocsSite entries
            const sitesFromDocsSiteTable: DashboardDocsSite[] = docsSiteRecords.map((record) => ({
                mainUrl: {
                    domain: record.domain,
                    path: record.basepath || undefined
                },
                urls: [
                    {
                        domain: record.domain,
                        path: record.basepath || undefined
                    }
                ],
                status: record.status
            }));

            // 5. Fallback: include DocsV2 sites that are NOT already represented in the DocsSite table
            const fallbackSites: DashboardDocsSite[] = docsV2Result.docsSites
                .filter((docsV2Site: DocsV2DocsSite) => {
                    // Check if any URL from this DocsV2 site matches a DocsSite record
                    return !docsV2Site.urls.some((url) => {
                        const key = `${url.domain}::${url.path ?? ""}`;
                        return docsSiteKeys.has(key);
                    });
                })
                .map(
                    (docsV2Site: DocsV2DocsSite): DashboardDocsSite => ({
                        mainUrl: docsV2Site.mainUrl,
                        urls: docsV2Site.urls,
                        status: "LIVE"
                    })
                );

            return {
                docsSites: [...sitesFromDocsSiteTable, ...fallbackSites]
            };
        });

    return { getDocsSitesForOrg };
}
