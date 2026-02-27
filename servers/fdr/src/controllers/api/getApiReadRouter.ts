import { convertDbAPIDefinitionToRead } from "@fern-api/fdr-sdk";
import { ApiDefinitionV1ToLatest } from "@fern-api/fdr-sdk/api-definition";
import type { LatestApiDefinitionSchema, ReadApiDefinitionSchema } from "@fern-api/fdr-sdk/orpc-client";
import { ORPCError, os } from "@orpc/server";
import * as z from "zod";

import type { FdrApplication } from "../../app";

export function createReadApiRouter(app: FdrApplication): Record<string, unknown> {
    const getApi = os
        .route({ method: "GET", path: "/load/{apiDefinitionId}" })
        .input(z.custom<{ apiDefinitionId: string }>())
        .output(z.custom<z.infer<typeof ReadApiDefinitionSchema>>())
        .handler(async ({ input, context }) => {
            const headers = (context as { headers: Record<string, string | undefined> }).headers;
            const authorization = headers.authorization;

            try {
                await app.services.auth.checkUserBelongsToOrg({
                    authHeader: authorization,
                    orgId: "fern"
                });
            } catch (fern_error) {
                if (fern_error instanceof ORPCError && fern_error.code === "FORBIDDEN") {
                    const orgId = await app.dao.apis().getOrgIdForApiDefinition(input.apiDefinitionId);
                    if (orgId == null) {
                        app.logger.warn("[getApiRead] API does not exist", {
                            apiDefinitionId: input.apiDefinitionId,
                            authorizationType: headers.authorization?.split(" ")[0],
                            userAgent: headers["user-agent"],
                            referer: headers.referer,
                            origin: headers.origin,
                            host: headers.host,
                            xForwardedFor: headers["x-forwarded-for"],
                            xRealIp: headers["x-real-ip"],
                            xForwardedHost: headers["x-forwarded-host"],
                            xForwardedProto: headers["x-forwarded-proto"],
                            requestId: headers["x-request-id"],
                            amznTraceId: headers["x-amzn-trace-id"],
                            reason: "orgId not found for apiDefinitionId"
                        });
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
                app.logger.warn("[getApiRead] API does not exist", {
                    apiDefinitionId: input.apiDefinitionId,
                    authorizationType: headers.authorization?.split(" ")[0],
                    userAgent: headers["user-agent"],
                    referer: headers.referer,
                    origin: headers.origin,
                    host: headers.host,
                    xForwardedFor: headers["x-forwarded-for"],
                    xRealIp: headers["x-real-ip"],
                    xForwardedHost: headers["x-forwarded-host"],
                    xForwardedProto: headers["x-forwarded-proto"],
                    requestId: headers["x-request-id"],
                    amznTraceId: headers["x-amzn-trace-id"],
                    reason: "definition not found"
                });
                throw new ORPCError("NOT_FOUND", {
                    message: "API does not exist"
                });
            }
            const readApiDefinition = convertDbAPIDefinitionToRead(dbApiDefinition);
            return readApiDefinition as z.infer<typeof ReadApiDefinitionSchema>;
        });

    const getApiDefinitionFull = os
        .route({ method: "GET", path: "/load-full/{apiDefinitionId}" })
        .input(z.custom<{ apiDefinitionId: string }>())
        .output(z.custom<z.infer<typeof LatestApiDefinitionSchema>>())
        .handler(async ({ input, context }) => {
            const headers = (context as { headers: Record<string, string | undefined> }).headers;
            const authorization = headers.authorization;

            try {
                await app.services.auth.checkUserBelongsToOrg({
                    authHeader: authorization,
                    orgId: "fern"
                });
            } catch (fern_error) {
                if (fern_error instanceof ORPCError && fern_error.code === "FORBIDDEN") {
                    const orgId = await app.dao.apis().getOrgIdForApiDefinition(input.apiDefinitionId);
                    if (orgId == null) {
                        app.logger.warn("[getApiReadFull] API does not exist", {
                            apiDefinitionId: input.apiDefinitionId,
                            authorizationType: headers.authorization?.split(" ")[0],
                            userAgent: headers["user-agent"],
                            referer: headers.referer,
                            origin: headers.origin,
                            host: headers.host,
                            xForwardedFor: headers["x-forwarded-for"],
                            xRealIp: headers["x-real-ip"],
                            xForwardedHost: headers["x-forwarded-host"],
                            xForwardedProto: headers["x-forwarded-proto"],
                            requestId: headers["x-request-id"],
                            amznTraceId: headers["x-amzn-trace-id"],
                            reason: "orgId not found for apiDefinitionId"
                        });
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
            if (latestApiDefinition != null) {
                return latestApiDefinition as z.infer<typeof LatestApiDefinitionSchema>;
            }

            // Fallback: load from APIV2 and migrate to latest format
            const dbApiDefinition = await app.dao.apis().loadAPIDefinition(input.apiDefinitionId);
            if (dbApiDefinition == null) {
                app.logger.warn("[getApiReadFull] API does not exist", {
                    apiDefinitionId: input.apiDefinitionId,
                    authorizationType: headers.authorization?.split(" ")[0],
                    userAgent: headers["user-agent"],
                    referer: headers.referer,
                    origin: headers.origin,
                    host: headers.host,
                    xForwardedFor: headers["x-forwarded-for"],
                    xRealIp: headers["x-real-ip"],
                    xForwardedHost: headers["x-forwarded-host"],
                    xForwardedProto: headers["x-forwarded-proto"],
                    requestId: headers["x-request-id"],
                    amznTraceId: headers["x-amzn-trace-id"],
                    reason: "definition not found in latest or v2"
                });
                throw new ORPCError("NOT_FOUND", {
                    message: "API does not exist"
                });
            }

            app.logger.info("[getApiReadFull] Falling back to APIV2 migration", {
                apiDefinitionId: input.apiDefinitionId
            });
            const v1ApiDefinition = convertDbAPIDefinitionToRead(dbApiDefinition);
            return ApiDefinitionV1ToLatest.from(v1ApiDefinition).migrate() as z.infer<typeof LatestApiDefinitionSchema>;
        });

    const getEndpointById = os
        .route({ method: "GET", path: "/load/{apiDefinitionId}/endpoint/{endpointId}" })
        .input(z.custom<{ apiDefinitionId: string; endpointId: string }>())
        .handler(async () => {
            throw new ORPCError("NOT_IMPLEMENTED", {
                message:
                    "getEndpointById endpoint is not implemented in the FDR service. Use the lambda endpoint instead."
            });
        });

    const getEndpointByLocator = os
        .route({ method: "GET", path: "/load/{apiDefinitionId}/endpoint" })
        .input(z.custom<{ apiDefinitionId: string; method: string; path: string }>())
        .handler(async () => {
            throw new ORPCError("NOT_IMPLEMENTED", {
                message:
                    "getEndpointByLocator endpoint is not implemented in the FDR service. Use the lambda endpoint instead."
            });
        });

    return { getApi, getApiDefinitionFull, getEndpointById, getEndpointByLocator };
}
