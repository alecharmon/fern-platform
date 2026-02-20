import {
    type APIV1Db,
    type APIV1Read,
    convertDbAPIDefinitionToRead,
    convertDocsDefinitionToRead,
    DocsV1Db,
    type DocsV1Read,
    FdrAPI,
    FernNavigation,
    migrateDocsDbDefinition
} from "@fern-api/fdr-sdk";

export * as DocsV1DbSchemas from "./db";
export * as DocsV1ReadSchemas from "./read";

import { AuthType } from "@prisma/client";
import { keyBy } from "es-toolkit/array";
import { mapValues } from "es-toolkit/object";

import { DocsV1ReadService } from "../../../api";
import { UnauthorizedError } from "../../../api/generated/api";
import { DomainNotRegisteredError } from "../../../api/generated/api/resources/docs/resources/v1/resources/read";
import type { FdrApplication } from "../../../app";
import type { LoadDocsDefinitionByUrlResponse } from "../../../db";
import { readBuffer } from "../../../util";
import { getFilesV2 } from "../../../util/getFilesV2";

export function getDocsReadService(app: FdrApplication): DocsV1ReadService {
    return new DocsV1ReadService({
        getDocsForDomainLegacy: async (req, res) => {
            // TODO: start deleting this deprecated endpoint
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: req.headers.authorization,
                orgId: "fern"
            });
            const definition = await getDocsForDomain({
                app,
                domain: req.params.domain
            });
            return res.send(definition.response);
        },
        getDocsForDomain: async (req, res) => {
            // TODO: start deleting this deprecated endpoint
            await app.services.auth.checkUserBelongsToOrg({
                authHeader: req.headers.authorization,
                orgId: "fern"
            });
            const definition = await getDocsForDomain({
                app,
                domain: req.body.domain
            });
            return res.send(definition.response);
        }
    });
}

export async function getDocsForDomain({
    app,
    domain,
    excludeApis
}: {
    app: FdrApplication;
    domain: string;
    excludeApis?: boolean | undefined;
}): Promise<{
    response: DocsV1Read.DocsDefinition;
    dbFiles?: Record<DocsV1Read.FileId, DocsV1Db.DbFileInfoV2>;
}> {
    const [docs, docsV2] = await Promise.all([
        app.services.db.prisma.docs.findFirst({
            where: {
                url: domain
            }
        }),
        app.services.db.prisma.docsV2.findFirst({
            where: {
                domain
            }
        })
    ]);

    if (!docs) {
        throw new DomainNotRegisteredError();
    }
    const docsDefinitionJson = readBuffer(docs.docsDefinition);
    const docsDbDefinition = migrateDocsDbDefinition(docsDefinitionJson);

    if (docsV2 != null && docsV2.authType !== AuthType.PUBLIC) {
        throw new UnauthorizedError("You must be authorized to view this documentation.");
    }

    return {
        response: await getDocsDefinition({
            app,
            docsDbDefinition,
            docsV2:
                docsV2 != null
                    ? {
                          orgId: FdrAPI.OrgId(docsV2.orgID),
                          docsDefinition: migrateDocsDbDefinition(readBuffer(docsV2.docsDefinition)),
                          docsConfigInstanceId:
                              docsV2.docsConfigInstanceId != null
                                  ? FdrAPI.DocsConfigId(docsV2.docsConfigInstanceId)
                                  : null,
                          indexSegmentIds: docsV2.indexSegmentIds as string[],
                          path: docsV2.path,
                          domain: docsV2.domain,
                          updatedTime: docsV2.updatedTime,
                          authType: docsV2.authType,
                          hasPublicS3Assets: docsV2.hasPublicS3Assets,
                          isPreview: docsV2.isPreview
                      }
                    : null,
            excludeApis: excludeApis ?? false
        }),
        dbFiles: docsDbDefinition.files
    };
}

export async function getDocsDefinition({
    app,
    docsDbDefinition,
    docsV2,
    excludeApis
}: {
    app: FdrApplication;
    docsDbDefinition: DocsV1Db.DocsDefinitionDb;
    docsV2: LoadDocsDefinitionByUrlResponse | null;
    excludeApis?: boolean | undefined;
}): Promise<DocsV1Read.DocsDefinition> {
    let apiDefinitions: any[];
    let apiV2Definitions: any[];
    let apiNameToId: Record<string, FernNavigation.ApiDefinitionId> | undefined;

    if (excludeApis) {
        apiDefinitions = [];
        apiV2Definitions = [];

        // When excluding APIs, fetch only the apiName -> apiDefinitionId mapping for lazy loading
        const apiNameMappings = await app.services.db.prisma.apiDefinitionsV2.findMany({
            where: {
                apiDefinitionId: {
                    in: Array.from(docsDbDefinition.referencedApis)
                }
            },
            select: {
                apiName: true,
                apiDefinitionId: true
            }
        });

        apiNameToId = {};
        for (const mapping of apiNameMappings) {
            apiNameToId[mapping.apiName] = FernNavigation.ApiDefinitionId(mapping.apiDefinitionId);
        }
    } else {
        [apiDefinitions, apiV2Definitions] = await Promise.all([
            app.services.db.prisma.apiDefinitionsV2.findMany({
                where: {
                    apiDefinitionId: {
                        in: Array.from(docsDbDefinition.referencedApis)
                    }
                }
            }),
            app.services.db.prisma.apiDefinitionsLatest.findMany({
                where: {
                    apiDefinitionId: {
                        in: Array.from(docsDbDefinition.referencedApis)
                    }
                }
            })
        ]);

        // Build apiNameToId mapping from the already-loaded API definitions
        // Use apiDefinitions (v2 table) as the source since apiV2Definitions (latest table) may not always be populated
        apiNameToId = {};
        for (const def of apiDefinitions) {
            apiNameToId[def.apiName] = FernNavigation.ApiDefinitionId(def.apiDefinitionId);
        }
    }

    const bufferedApiDefinitionsById = keyBy(apiDefinitions, (def) => DocsV1Db.ApiDefinitionId(def.apiDefinitionId));

    const filesV2 = await getFilesV2(docsDbDefinition, app);

    const apiDefinitionsById = mapValues(bufferedApiDefinitionsById, (def) =>
        convertDbApiDefinitionToRead(def.definition)
    );

    const apiV2DefinitionsById = mapValues(
        keyBy(apiV2Definitions, (def) => FernNavigation.ApiDefinitionId(def.apiDefinitionId)),
        (def) => readBuffer(def.definition) as FdrAPI.api.latest.ApiDefinition
    );

    return convertDocsDefinitionToRead({
        docsDbDefinition,
        filesV2,
        apis: apiDefinitionsById,
        apisV2: apiV2DefinitionsById,
        id: docsV2?.docsConfigInstanceId ?? undefined,
        apiNameToId
    });
}

export function convertDbApiDefinitionToRead(buffer: Buffer): APIV1Read.ApiDefinition {
    const apiDefinitionJson = readBuffer(buffer) as APIV1Db.DbApiDefinition;
    return convertDbAPIDefinitionToRead(apiDefinitionJson);
}
