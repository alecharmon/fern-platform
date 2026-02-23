import {
    GenerateTokenInputSchema,
    GenerateTokenOutputSchema,
    RevokeTokenInputSchema
} from "@fern-api/fdr-sdk/orpc-client";
import { FernVenusApi, FernVenusApiClient } from "@fern-api/venus-api-sdk";
import { ORPCError, os } from "@orpc/server";
import { v4 as uuidv4 } from "uuid";

import type { FdrApplication } from "../../app";
import { getTokenFromAuthHeader } from "../../services/auth/AuthService";

export function createTokensRouter(app: FdrApplication) {
    const generate = os
        .route({ method: "POST", path: "/generate" })
        .input(GenerateTokenInputSchema)
        .output(GenerateTokenOutputSchema)
        .handler(async ({ input, context }) => {
            const authorization = (context as { headers: Record<string, string | undefined> }).headers.authorization;
            if (authorization == null) {
                throw new ORPCError("UNAUTHORIZED", {
                    message: "No token specified. Please use your FERN_TOKEN"
                });
            }
            const token = getTokenFromAuthHeader(authorization);
            const venus = new FernVenusApiClient({
                environment: app.config.venusUrl,
                token
            });
            const response = await venus.registry.generateRegistryTokens({
                organizationId: FernVenusApi.OrganizationId(input.orgId)
            });
            if (response.ok) {
                return {
                    id: uuidv4(),
                    token: response.body.npm.token
                };
            }
            throw new ORPCError("INTERNAL_SERVER_ERROR", {
                message: "Failed to generate token."
            });
        });

    const revoke = os
        .route({ method: "POST", path: "/revoke" })
        .input(RevokeTokenInputSchema)
        .handler(async () => {
            return undefined;
        });

    return { generate, revoke };
}
