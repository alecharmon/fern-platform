import { convertDbAPIDefinitionToRead } from "@fern-api/fdr-sdk";
import { ApiDefinitionV1ToLatest } from "@fern-api/fdr-sdk/api-definition";
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
                        app.logger.warn("[getApiLatest] API does not exist", {
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

            const apiDefinition = await app.dao.apis().loadAPILatestDefinition(input.apiDefinitionId);
            if (apiDefinition != null) {
                return apiDefinition as z.infer<typeof ApiDefinitionSchema>;
            }

            // Fallback: load from APIV2 and migrate to latest format
            const dbApiDefinition = await app.dao.apis().loadAPIDefinition(input.apiDefinitionId);
            if (dbApiDefinition == null) {
                app.logger.warn("[getApiLatest] API does not exist", {
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

            app.logger.info("[getApiLatest] Falling back to APIV2 migration", {
                apiDefinitionId: input.apiDefinitionId
            });
            const v1ApiDefinition = convertDbAPIDefinitionToRead(dbApiDefinition);
            return ApiDefinitionV1ToLatest.from(v1ApiDefinition).migrate() as z.infer<typeof ApiDefinitionSchema>;
        });

    return { getApiLatest };
}
