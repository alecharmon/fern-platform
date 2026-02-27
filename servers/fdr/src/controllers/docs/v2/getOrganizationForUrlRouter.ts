import type { GetOrganizationForUrlInputSchema } from "@fern-api/fdr-sdk/orpc-client";
import { ORPCError, os } from "@orpc/server";
import * as z from "zod";

import type { FdrApplication } from "../../../app";
import { ParsedBaseUrl } from "../../../util/ParsedBaseUrl";

export function createGetOrganizationForUrlRouter(app: FdrApplication) {
    const getOrganizationForUrl = os
        .route({ method: "POST", path: "/organization-for-url" })
        .input(z.custom<z.infer<typeof GetOrganizationForUrlInputSchema>>())
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: authorization,
                orgId: "fern"
            });
            const parsedUrl = ParsedBaseUrl.parse(input.url);
            const orgId = await app.dao.docsV2().getOrgIdForDocsUrl(parsedUrl.toURL());
            if (orgId == null) {
                throw new ORPCError("NOT_FOUND");
            }
            return orgId;
        });

    return { getOrganizationForUrl };
}
