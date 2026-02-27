import type { GetDocsSitesForOrgResponseSchema } from "@fern-api/fdr-sdk/orpc-client";
import { os } from "@orpc/server";
import * as z from "zod";

import type { FdrApplication } from "../../app";

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
            const result = await app.dao.docsV2().listDocsSitesForOrg(input.orgId);
            return result;
        });

    return { getDocsSitesForOrg };
}
