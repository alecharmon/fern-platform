import { convertDbAPIDefinitionToRead } from "@fern-api/fdr-sdk";

export * as ReadSchemas from "./read";

import { APIV1ReadService } from "../../api";
import { UserNotInOrgError } from "../../api/generated/api";
import { ApiDoesNotExistError } from "../../api/generated/api/resources/api/resources/v1/resources/read/errors";
import type { FdrApplication } from "../../app";

export function getReadApiService(app: FdrApplication): APIV1ReadService {
    return new APIV1ReadService({
        getApi: async (req, res) => {
            try {
                // if the auth header belongs to fern, return the api definition
                await app.services.auth.checkUserBelongsToOrg({
                    authHeader: req.headers.authorization,
                    orgId: "fern"
                });
            } catch (fern_error) {
                if (fern_error instanceof UserNotInOrgError) {
                    try {
                        // if the auth header belongs to org, return the api definition
                        const orgId = await app.dao.apis().getOrgIdForApiDefinition(req.params.apiDefinitionId);
                        if (orgId == null) {
                            throw new ApiDoesNotExistError();
                        }
                        await app.services.auth.checkUserBelongsToOrg({
                            authHeader: req.headers.authorization,
                            orgId
                        });
                    } catch (org_error) {
                        throw org_error;
                    }
                } else {
                    throw fern_error;
                }
            }
            const dbApiDefinition = await app.dao.apis().loadAPIDefinition(req.params.apiDefinitionId);
            if (dbApiDefinition == null) {
                throw new ApiDoesNotExistError();
            }
            const readApiDefinition = convertDbAPIDefinitionToRead(dbApiDefinition);
            return res.send(readApiDefinition);
        },
        getApiDefinitionFull: async (req, res) => {
            try {
                // if the auth header belongs to fern, return the api definition
                await app.services.auth.checkUserBelongsToOrg({
                    authHeader: req.headers.authorization,
                    orgId: "fern"
                });
            } catch (fern_error) {
                if (fern_error instanceof UserNotInOrgError) {
                    try {
                        // if the auth header belongs to org, return the api definition
                        const orgId = await app.dao.apis().getOrgIdForApiDefinition(req.params.apiDefinitionId);
                        if (orgId == null) {
                            throw new ApiDoesNotExistError();
                        }
                        await app.services.auth.checkUserBelongsToOrg({
                            authHeader: req.headers.authorization,
                            orgId
                        });
                    } catch (org_error) {
                        throw org_error;
                    }
                } else {
                    throw fern_error;
                }
            }
            const latestApiDefinition = await app.dao.apis().loadAPILatestDefinition(req.params.apiDefinitionId);
            if (latestApiDefinition == null) {
                throw new ApiDoesNotExistError();
            }
            return res.send(latestApiDefinition);
        },
        getEndpointById: async (req, res) => {
            // This endpoint is only implemented in the lambda version of the service
            // The FDR service redirects to the lambda endpoint
            throw new Error(
                "getEndpointById endpoint is not implemented in the FDR service. Use the lambda endpoint instead."
            );
        },
        getEndpointByLocator: async (req, res) => {
            // This endpoint is only implemented in the lambda version of the service
            // The FDR service redirects to the lambda endpoint
            throw new Error(
                "getEndpointByLocator endpoint is not implemented in the FDR service. Use the lambda endpoint instead."
            );
        }
    });
}
