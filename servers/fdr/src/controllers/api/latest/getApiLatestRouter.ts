import { LatestApiDefinitionSchema } from "@fern-api/fdr-sdk/orpc-client";
import { ORPCError, os } from "@orpc/server";
import * as z from "zod";
import type { FdrApplication } from "../../../app";

const ApiDefinitionSchema = LatestApiDefinitionSchema;

export function createGetApiLatestRouter(app: FdrApplication): Record<string, unknown> {
    const getApiLatest = os
        .route({ method: "GET", path: "/load/{apiDefinitionId}" })
        .input(z.custom<{ apiDefinitionId: string }>())
        .output(z.custom<z.infer<typeof ApiDefinitionSchema>>())
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;

            try {
                await app.services.auth.checkUserBelongsToOrg({
                    authHeader: authorization,
                    orgId: "fern"
                });
            } catch (fern_error) {
                if (fern_error instanceof ORPCError && fern_error.code === "FORBIDDEN") {
                    const orgId = await app.dao.apis().getOrgIdForApiDefinition(input.apiDefinitionId);
                    if (orgId == null) {
                        throw new ORPCError("NOT_FOUND", {
                            message: "API does not exist"
                        });
                    }
                    await app.services.auth.checkUserBelongsToOrg({
                        authHeader: authorization,
                        orgId
                    });
                } else {
                    throw fern_error;
                }
            }

            const apiDefinition = await app.dao.apis().loadAPILatestDefinition(input.apiDefinitionId);
            if (apiDefinition == null) {
                throw new ORPCError("NOT_FOUND", {
                    message: "API does not exist"
                });
            }
            return apiDefinition as z.infer<typeof ApiDefinitionSchema>;
        });

    return { getApiLatest };
}
