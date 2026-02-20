import { convertDbAPIDefinitionToRead } from "@fern-api/fdr-sdk";
import { ORPCError, os } from "@orpc/server";
import * as z from "zod";

import { UserNotInOrgError } from "../../api/generated/api";
import type { FdrApplication } from "../../app";
import { ApiDefinitionSchema as LatestApiDefinitionSchema } from "./latest/index";
import { ApiDefinitionSchema as ReadApiDefinitionSchema } from "./read/index";

export * as ReadSchemas from "./read";

export function createReadApiRouter(app: FdrApplication) {
    const getApi = os
        .route({ method: "GET", path: "/load/{apiDefinitionId}" })
        .input(z.object({ apiDefinitionId: z.string() }))
        .output(ReadApiDefinitionSchema)
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;

            try {
                await app.services.auth.checkUserBelongsToOrg({
                    authHeader: authorization,
                    orgId: "fern"
                });
            } catch (fern_error) {
                if (fern_error instanceof UserNotInOrgError) {
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
            const dbApiDefinition = await app.dao.apis().loadAPIDefinition(input.apiDefinitionId);
            if (dbApiDefinition == null) {
                throw new ORPCError("NOT_FOUND", {
                    message: "API does not exist"
                });
            }
            const readApiDefinition = convertDbAPIDefinitionToRead(dbApiDefinition);
            return readApiDefinition as z.infer<typeof ReadApiDefinitionSchema>;
        });

    const getApiDefinitionFull = os
        .route({ method: "GET", path: "/load-full/{apiDefinitionId}" })
        .input(z.object({ apiDefinitionId: z.string() }))
        .output(LatestApiDefinitionSchema)
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;

            try {
                await app.services.auth.checkUserBelongsToOrg({
                    authHeader: authorization,
                    orgId: "fern"
                });
            } catch (fern_error) {
                if (fern_error instanceof UserNotInOrgError) {
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
            const latestApiDefinition = await app.dao.apis().loadAPILatestDefinition(input.apiDefinitionId);
            if (latestApiDefinition == null) {
                throw new ORPCError("NOT_FOUND", {
                    message: "API does not exist"
                });
            }
            return latestApiDefinition as z.infer<typeof LatestApiDefinitionSchema>;
        });

    const getEndpointById = os
        .route({ method: "GET", path: "/load/{apiDefinitionId}/endpoint/{endpointId}" })
        .input(z.object({ apiDefinitionId: z.string(), endpointId: z.string() }))
        .handler(async () => {
            throw new ORPCError("NOT_IMPLEMENTED", {
                message:
                    "getEndpointById endpoint is not implemented in the FDR service. Use the lambda endpoint instead."
            });
        });

    const getEndpointByLocator = os
        .route({ method: "GET", path: "/load/{apiDefinitionId}/endpoint" })
        .input(z.object({ apiDefinitionId: z.string(), method: z.string(), path: z.string() }))
        .handler(async () => {
            throw new ORPCError("NOT_IMPLEMENTED", {
                message:
                    "getEndpointByLocator endpoint is not implemented in the FDR service. Use the lambda endpoint instead."
            });
        });

    return { getApi, getApiDefinitionFull, getEndpointById, getEndpointByLocator };
}
