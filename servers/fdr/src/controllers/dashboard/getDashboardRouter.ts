import { os } from "@orpc/server";
import * as z from "zod";

import type { FdrApplication } from "../../app";

const DocsSiteUrlSchema = z.object({
    domain: z.string(),
    path: z.string().optional()
});

const DocsSiteSchema = z.object({
    mainUrl: DocsSiteUrlSchema,
    urls: z.array(DocsSiteUrlSchema)
});

const GetDocsSitesForOrgResponseSchema = z.object({
    docsSites: z.array(DocsSiteSchema)
});

export function createDashboardRouter(app: FdrApplication) {
    const getDocsSitesForOrg = os
        .route({ method: "POST", path: "/get-docs-sites-for-org" })
        .input(
            z.object({
                orgId: z.string()
            })
        )
        .output(GetDocsSitesForOrgResponseSchema)
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: input.orgId
            });
            const result = await app.dao.docsV2().listDocsSitesForOrg(input.orgId);
            return result;
        });

    return { getDocsSitesForOrg };
}
