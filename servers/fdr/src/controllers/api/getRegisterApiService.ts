import { type APIV1Db, type APIV1Write, convertAPIDefinitionToDb, FdrAPI, SDKSnippetHolder } from "@fern-api/fdr-sdk";
import { v4 as uuidv4 } from "uuid";

import { APIV1WriteService } from "../../api";
import type { SdkRequest } from "../../api/generated/api";
import type { DynamicIr, DynamicIrUpload } from "../../api/generated/api/resources/api/resources/v1/resources/register";
import type { FdrApplication } from "../../app";
import { LOGGER } from "../../app/FdrApplication";
import type { SdkIdForPackage } from "../../db/sdk/SdkDao";
import type {
    SnippetTemplatesByEndpoint,
    SnippetTemplatesByEndpointIdentifier
} from "../../db/snippets/SnippetTemplate";
import { writeBuffer } from "../../util";

const REGISTER_API_DEFINITION_META = {
    service: "APIV1WriteService",
    endpoint: "registerApiDefinition"
};

const SLOW_OPERATION_THRESHOLD_MS = 30000; // 30 seconds

function logSlowOperation(operation: string, durationMs: number) {
    LOGGER.warn(
        `Operation "${operation}" took ${durationMs}ms (threshold: ${SLOW_OPERATION_THRESHOLD_MS}ms)`,
        REGISTER_API_DEFINITION_META
    );
}

export function getRegisterApiService(app: FdrApplication): APIV1WriteService {
    return new APIV1WriteService({
        registerApiDefinition: async (req, res) => {
            const startTime = Date.now();
            let lastOperationTime = startTime;

            const logOperationTime = (operation: string) => {
                const now = Date.now();
                const duration = now - lastOperationTime;
                if (duration > SLOW_OPERATION_THRESHOLD_MS) {
                    logSlowOperation(operation, duration);
                }
                lastOperationTime = now;
            };

            app.logger.debug(`Checking if user belongs to org ${req.body.orgId}`, REGISTER_API_DEFINITION_META);
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: req.headers.authorization,
                orgId: req.body.orgId
            });
            logOperationTime("checkUserBelongsToOrg");

            let apiDefinitionId = FdrAPI.ApiDefinitionId(uuidv4());
            let transformedApiDefinition: APIV1Db.DbApiDefinition | FdrAPI.api.latest.ApiDefinition | undefined;

            const snippetsConfiguration = req.body.definition?.snippetsConfiguration ?? {
                typescriptSdk: undefined,
                pythonSdk: undefined,
                javaSdk: undefined,
                goSdk: undefined,
                rubySdk: undefined,
                csharpSdk: undefined,
                phpSdk: undefined,
                swiftSdk: undefined,
                rustSdk: undefined
            };

            const snippetsConfigurationWithSdkIds = await app.dao.sdks().getSdkIdsForPackages(snippetsConfiguration);
            logOperationTime("getSdkIdsForPackages");

            const sdkIds: string[] = [];
            if (snippetsConfigurationWithSdkIds.typescriptSdk != null) {
                sdkIds.push(snippetsConfigurationWithSdkIds.typescriptSdk.sdkId);
            }
            if (snippetsConfigurationWithSdkIds.pythonSdk != null) {
                sdkIds.push(snippetsConfigurationWithSdkIds.pythonSdk.sdkId);
            }
            if (snippetsConfigurationWithSdkIds.javaSdk != null) {
                sdkIds.push(snippetsConfigurationWithSdkIds.javaSdk.sdkId);
            }
            if (snippetsConfigurationWithSdkIds.goSdk != null) {
                sdkIds.push(snippetsConfigurationWithSdkIds.goSdk.sdkId);
            }
            if (snippetsConfigurationWithSdkIds.rubySdk != null) {
                sdkIds.push(snippetsConfigurationWithSdkIds.rubySdk.sdkId);
            }
            if (snippetsConfigurationWithSdkIds.csharpSdk != null) {
                sdkIds.push(snippetsConfigurationWithSdkIds.csharpSdk.sdkId);
            }
            if (snippetsConfigurationWithSdkIds.rustSdk != null) {
                sdkIds.push(snippetsConfigurationWithSdkIds.rustSdk.sdkId);
            }

            let snippetsBySdkId = {};
            let snippetsBySdkIdAndEndpointId = {};
            let snippetTemplatesByEndpoint: SnippetTemplatesByEndpoint = {};
            let snippetTemplatesByEndpointId: SnippetTemplatesByEndpointIdentifier = {};

            if (!req.body.dynamicIRs) {
                app.logger.debug("No dynamicIRs detected, creating snippet holder");

                snippetsBySdkId = await app.dao.snippets().loadAllSnippetsForSdkIds(sdkIds);
                logOperationTime("loadAllSnippetsForSdkIds");

                snippetsBySdkIdAndEndpointId = await app.dao.snippets().loadAllSnippetsForSdkIdsByEndpointId(sdkIds);
                logOperationTime("loadAllSnippetsForSdkIdsByEndpointId");

                snippetTemplatesByEndpoint = await getSnippetTemplatesIfEnabled({
                    app,
                    authorization: req.headers.authorization,
                    orgId: req.body.orgId,
                    apiId: req.body.apiId,
                    definition: req.body.definition ?? req.body.definitionV2,
                    snippetsConfigurationWithSdkIds
                });
                logOperationTime("getSnippetTemplatesIfEnabled");

                snippetTemplatesByEndpointId = await getSnippetTemplatesByEndpointIdIfEnabled({
                    app,
                    authorization: req.headers.authorization,
                    orgId: req.body.orgId,
                    apiId: req.body.apiId,
                    definition: req.body.definition ?? req.body.definitionV2,
                    snippetsConfigurationWithSdkIds
                });
                logOperationTime("getSnippetTemplatesByEndpointIdIfEnabled");
            } else {
                app.logger.debug("Receieved dynamicIR - using empty snippet holder");
            }

            const snippetHolder = new SDKSnippetHolder({
                snippetsBySdkId,
                snippetsBySdkIdAndEndpointId,
                snippetsConfigWithSdkId: snippetsConfigurationWithSdkIds,
                snippetTemplatesByEndpoint,
                snippetTemplatesByEndpointId
            });

            if (req.body.definition != null && Object.keys(req.body.definition).length > 0) {
                transformedApiDefinition = convertAPIDefinitionToDb(
                    req.body.definition,
                    apiDefinitionId,
                    snippetHolder
                );
            }
            logOperationTime("convertAPIDefinitionToDb");

            let sources: Record<string, APIV1Write.SourceUpload> | undefined;
            if (req.body.sources != null) {
                app.logger.debug(
                    `Preparing source upload URLs for {orgId: "${req.body.orgId}", apiId: "${req.body.apiId}"}`,
                    REGISTER_API_DEFINITION_META
                );
                sources = await getSourceUploads({
                    app,
                    orgId: req.body.orgId,
                    apiId: req.body.apiId,
                    sources: req.body.sources
                });
                logOperationTime("getSourceUploads");
                app.logger.debug("Successfully prepared source upload URLs", REGISTER_API_DEFINITION_META);
            }

            let dynamicIRsUploads: Record<string, DynamicIrUpload> | undefined;
            if (req.body.dynamicIRs) {
                app.logger.debug(
                    `Preparing dynamic IR upload URLs for {orgId: "${req.body.orgId}", apiId: "${req.body.apiId}"}`,
                    REGISTER_API_DEFINITION_META
                );
                dynamicIRsUploads = await getDynamicIrsUploads({
                    app,
                    orgId: req.body.orgId,
                    apiId: apiDefinitionId,
                    dynamicIRs: req.body.dynamicIRs
                });

                logOperationTime("getDynamicIrsUploads");
                app.logger.debug("Successfully prepared dynamic IR upload URLs", REGISTER_API_DEFINITION_META);
            }

            app.logger.debug(
                `Creating API Definition in database with id=${apiDefinitionId}, name=${req.body.apiId} for org ${req.body.orgId}`,
                REGISTER_API_DEFINITION_META
            );
            await app.services.db.prisma.apiDefinitionsV2.create({
                data: {
                    apiDefinitionId,
                    apiName: req.body.apiId,
                    orgId: req.body.orgId,
                    definition: writeBuffer(transformedApiDefinition)
                }
            });
            logOperationTime("createApiDefinition");

            if (
                transformedApiDefinition != null &&
                "rootPackage" in transformedApiDefinition &&
                (transformedApiDefinition.rootPackage.endpoints.length > 0 ||
                    Object.values(transformedApiDefinition.subpackages).some(
                        (subpackage) => subpackage.endpoints.length > 0
                    ))
            ) {
                app.logger.info(
                    `Storing individual endpoints for API Definition id=${apiDefinitionId}`,
                    REGISTER_API_DEFINITION_META
                );

                await storeEndpoints({
                    app,
                    apiDefinitionId,
                    apiDefinition: transformedApiDefinition
                });
                logOperationTime("storeEndpoints");
            }

            const totalDuration = Date.now() - startTime;
            LOGGER.warn(
                `API Registration for ${req.body.orgId}:${req.body.apiId} took ${totalDuration}ms`,
                REGISTER_API_DEFINITION_META
            );

            app.logger.debug(`Returning API Definition ID id=${apiDefinitionId}`, REGISTER_API_DEFINITION_META);
            return res.send({
                apiDefinitionId,
                sources,
                dynamicIRs: dynamicIRsUploads
            });
        }
    });
}

async function storeEndpoints({
    app,
    apiDefinitionId,
    apiDefinition
}: {
    app: FdrApplication;
    apiDefinitionId: FdrAPI.ApiDefinitionId;
    apiDefinition: APIV1Db.DbApiDefinition;
}): Promise<void> {
    try {
        // Store types separately, once per API definition
        await app.services.db.prisma.apiDefinitionTypes.upsert({
            where: { apiDefinitionId },
            create: {
                apiDefinitionId,
                types: writeBuffer(apiDefinition.types)
            },
            update: {
                types: writeBuffer(apiDefinition.types)
            }
        });

        const endpointData: Array<{
            apiDefinitionId: string;
            endpointId: string;
            method: FdrAPI.HttpMethod;
            path: string;
            endpoint: Buffer;
        }> = [];

        const processEndpoint = (endpoint: APIV1Db.DbEndpointDefinition) => {
            let pathString = "";

            // The path is an EndpointPath object with a 'parts' array
            const pathParts = (endpoint.path as any)?.parts;

            if (Array.isArray(pathParts)) {
                pathString = pathParts
                    .map((part: any) => {
                        if (typeof part === "string") {
                            return part;
                        }
                        if (part.type === "literal") {
                            return part.value;
                        } else if (part.type === "pathParameter") {
                            return `{${part.value}}`;
                        }
                        return "";
                    })
                    .join("");
            } else if (typeof endpoint.path === "string") {
                pathString = endpoint.path;
            }

            const authSchemesMap: Record<FdrAPI.AuthSchemeId, FdrAPI.api.v1.read.ApiAuth> = {};
            if ("authSchemes" in apiDefinition && apiDefinition.authSchemes != null) {
                if (endpoint.authV2 != null) {
                    endpoint.authV2.forEach((authId: string) => {
                        const authScheme = apiDefinition.authSchemes?.[authId as FdrAPI.AuthSchemeId];
                        if (authScheme != null) {
                            authSchemesMap[authId as FdrAPI.AuthSchemeId] = authScheme;
                        }
                    });
                }
            }

            const endpointWithContext: APIV1Db.DbEndpointWithContext = {
                endpoint: endpoint,
                authSchemes: Object.keys(authSchemesMap).length > 0 ? authSchemesMap : undefined,
                globalHeaders: apiDefinition.globalHeaders ?? undefined
            };

            app.logger.debug(
                `Storing endpoint \`${endpoint.id}\` with method ${endpoint.method} and path \`${pathString}\` for apiDefinitionId \`${apiDefinitionId}\``
            );

            endpointData.push({
                apiDefinitionId,
                endpointId: endpoint.id,
                method: endpoint.method,
                path: pathString,
                endpoint: writeBuffer(endpointWithContext)
            });
        };

        if ("rootPackage" in apiDefinition) {
            apiDefinition.rootPackage.endpoints.forEach(processEndpoint);

            Object.values(apiDefinition.subpackages).forEach((subpackage) => {
                subpackage.endpoints.forEach(processEndpoint);
            });
        }

        if (endpointData.length === 0) {
            return;
        }

        // Batch insert endpoints using size-based batching to avoid hitting Prisma/Postgres payload limits.
        // We track the actual buffer sizes and flush when we exceed a threshold.
        const MAX_BATCH_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per batch (Postgres has ~10MB limit, leave headroom)
        const MAX_SINGLE_ENDPOINT_BYTES = 8 * 1024 * 1024; // 8MB - warn if a single endpoint exceeds this
        const MAX_ENDPOINTS_PER_BATCH = 100; // Also cap by count to avoid too many rows

        let currentBatch: typeof endpointData = [];
        let currentBatchSize = 0;

        for (const endpointRecord of endpointData) {
            const recordSize = endpointRecord.endpoint.length;

            // Warn if a single endpoint is extremely large
            if (recordSize > MAX_SINGLE_ENDPOINT_BYTES) {
                LOGGER.warn(
                    `Endpoint ${endpointRecord.endpointId} has very large payload: ${(recordSize / 1024 / 1024).toFixed(2)}MB. This may cause issues.`,
                    REGISTER_API_DEFINITION_META
                );
            }

            // Flush batch if adding this endpoint would exceed limits
            if (
                currentBatch.length > 0 &&
                (currentBatchSize + recordSize > MAX_BATCH_SIZE_BYTES || currentBatch.length >= MAX_ENDPOINTS_PER_BATCH)
            ) {
                await app.services.db.prisma.apiEndpoint.createMany({
                    data: currentBatch,
                    skipDuplicates: true
                });
                app.logger.debug(
                    `Inserted batch of ${currentBatch.length} endpoints (${(currentBatchSize / 1024 / 1024).toFixed(2)}MB)`,
                    REGISTER_API_DEFINITION_META
                );
                currentBatch = [];
                currentBatchSize = 0;
            }

            currentBatch.push(endpointRecord);
            currentBatchSize += recordSize;
        }

        // Insert remaining endpoints
        if (currentBatch.length > 0) {
            await app.services.db.prisma.apiEndpoint.createMany({
                data: currentBatch,
                skipDuplicates: true
            });
            app.logger.debug(
                `Inserted final batch of ${currentBatch.length} endpoints (${(currentBatchSize / 1024 / 1024).toFixed(2)}MB)`,
                REGISTER_API_DEFINITION_META
            );
        }

        app.logger.info(`Finished storing endpoints and types for apiDefinitionId \`${apiDefinitionId}\``);
    } catch (error) {
        LOGGER.error(`Failed to store endpoints for API Definition ${apiDefinitionId}`, error);
    }
}

function getSnippetSdkRequests({
    snippetsConfigurationWithSdkIds
}: {
    snippetsConfigurationWithSdkIds: SdkIdForPackage;
}): SdkRequest[] {
    const sdkRequests: SdkRequest[] = [];
    if (snippetsConfigurationWithSdkIds.typescriptSdk != null) {
        sdkRequests.push({
            type: "typescript",
            package: snippetsConfigurationWithSdkIds.typescriptSdk.package,
            version: snippetsConfigurationWithSdkIds.typescriptSdk.version
        });
    }
    if (snippetsConfigurationWithSdkIds.pythonSdk != null) {
        sdkRequests.push({
            type: "python",
            package: snippetsConfigurationWithSdkIds.pythonSdk.package,
            version: snippetsConfigurationWithSdkIds.pythonSdk.version
        });
    }
    if (snippetsConfigurationWithSdkIds.javaSdk != null) {
        const coordinate = snippetsConfigurationWithSdkIds.javaSdk.coordinate;
        const [group, artifact] = coordinate.split(":");
        if (group == null || artifact == null) {
            throw new Error(`Invalid coordinate for Java SDK: ${coordinate}. Must be in the format group:artifact`);
        }
        sdkRequests.push({
            type: "java",
            group,
            artifact,
            version: snippetsConfigurationWithSdkIds.javaSdk.version
        });
    }
    if (snippetsConfigurationWithSdkIds.goSdk != null) {
        sdkRequests.push({
            type: "go",
            githubRepo: snippetsConfigurationWithSdkIds.goSdk.githubRepo,
            version: snippetsConfigurationWithSdkIds.goSdk.version
        });
    }
    if (snippetsConfigurationWithSdkIds.rubySdk != null) {
        sdkRequests.push({
            type: "ruby",
            gem: snippetsConfigurationWithSdkIds.rubySdk.gem,
            version: snippetsConfigurationWithSdkIds.rubySdk.version
        });
    }
    if (snippetsConfigurationWithSdkIds.csharpSdk != null) {
        sdkRequests.push({
            type: "csharp",
            package: snippetsConfigurationWithSdkIds.csharpSdk.package,
            version: snippetsConfigurationWithSdkIds.csharpSdk.version
        });
    }
    return sdkRequests;
}

async function getSnippetTemplatesByEndpointIdIfEnabled({
    app,
    authorization,
    orgId,
    apiId,
    definition,
    snippetsConfigurationWithSdkIds
}: {
    app: FdrApplication;
    authorization: string | undefined;
    orgId: FdrAPI.OrgId;
    apiId: FdrAPI.ApiId;
    definition: APIV1Write.ApiDefinition | FdrAPI.api.latest.ApiDefinition | undefined;
    snippetsConfigurationWithSdkIds: SdkIdForPackage;
}): Promise<SnippetTemplatesByEndpointIdentifier> {
    try {
        if (definition == null) {
            return {};
        }
        const hasSnippetTemplatesAccess = await app.services.auth.checkOrgHasSnippetTemplateAccess({
            authHeader: authorization,
            orgId,
            failHard: false
        });
        let snippetTemplatesByEndpoint: SnippetTemplatesByEndpointIdentifier = {};
        if (hasSnippetTemplatesAccess) {
            const sdkRequests = getSnippetSdkRequests({
                snippetsConfigurationWithSdkIds
            });
            snippetTemplatesByEndpoint = await app.dao.snippetTemplates().loadSnippetTemplatesByEndpointIdentifier({
                orgId,
                apiId,
                sdkRequests,
                definition
            });
        }
        return snippetTemplatesByEndpoint;
    } catch (e) {
        LOGGER.error("Failed to load snippet templates", e);
        return {};
    }
}

async function getSnippetTemplatesIfEnabled({
    app,
    authorization,
    orgId,
    apiId,
    definition,
    snippetsConfigurationWithSdkIds
}: {
    app: FdrApplication;
    authorization: string | undefined;
    orgId: FdrAPI.OrgId;
    apiId: FdrAPI.ApiId;
    definition: APIV1Write.ApiDefinition | FdrAPI.api.latest.ApiDefinition | undefined;
    snippetsConfigurationWithSdkIds: SdkIdForPackage;
}): Promise<SnippetTemplatesByEndpoint> {
    try {
        if (definition == null) {
            return {};
        }
        const hasSnippetTemplatesAccess = await app.services.auth.checkOrgHasSnippetTemplateAccess({
            authHeader: authorization,
            orgId,
            failHard: false
        });
        let snippetTemplatesByEndpoint: SnippetTemplatesByEndpoint = {};
        if (hasSnippetTemplatesAccess) {
            const sdkRequests = getSnippetSdkRequests({
                snippetsConfigurationWithSdkIds
            });
            snippetTemplatesByEndpoint = await app.dao.snippetTemplates().loadSnippetTemplatesByEndpoint({
                orgId,
                apiId,
                sdkRequests,
                definition
            });
        }
        return snippetTemplatesByEndpoint;
    } catch (e) {
        LOGGER.error("Failed to load snippet templates", e);
        return {};
    }
}

async function getDynamicIrsUploads({
    app,
    orgId,
    apiId,
    dynamicIRs
}: {
    app: FdrApplication;
    orgId: FdrAPI.OrgId;
    apiId: APIV1Db.ApiDefinitionId;
    dynamicIRs: Record<string, DynamicIr> | undefined;
}): Promise<Record<string, DynamicIrUpload>> {
    const sourceUploadUrls = await app.services.s3.getPresignedApiDefinitionDynamicIRsUploadUrls({
        orgId,
        apiId,
        dynamicIRs
    });

    const sourceUploads = await Promise.all(
        Object.entries(sourceUploadUrls).map(async ([language, fileInfo]) => {
            return [
                language,
                {
                    uploadUrl: fileInfo.presignedUrl
                }
            ];
        })
    );

    return Object.fromEntries(sourceUploads);
}

async function getSourceUploads({
    app,
    orgId,
    apiId,
    sources
}: {
    app: FdrApplication;
    orgId: FdrAPI.OrgId;
    apiId: FdrAPI.ApiId;
    sources: Record<string, APIV1Write.Source> | undefined;
}): Promise<Record<string, APIV1Write.SourceUpload>> {
    const sourceUploadUrls = await app.services.s3.getPresignedApiDefinitionSourceUploadUrls({
        orgId,
        apiId,
        sources
    });

    const sourceUploads = await Promise.all(
        Object.entries(sourceUploadUrls).map(async ([sourceId, fileInfo]) => {
            const downloadUrl = await app.services.s3.getPresignedApiDefinitionSourceDownloadUrl({
                key: fileInfo.key
            });

            return [
                sourceId,
                {
                    uploadUrl: fileInfo.presignedUrl,
                    downloadUrl
                }
            ];
        })
    );

    return Object.fromEntries(sourceUploads);
}
