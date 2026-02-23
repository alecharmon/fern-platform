/** biome-ignore-all lint/suspicious/noConsole: i am too lazy to install a real logger here right now */

import type { APIV1Db, APIV1Read, DocsV1Db } from "@fern-api/fdr-sdk";
import {
    convertDbAPIDefinitionToRead,
    convertDbDocsConfigToRead,
    DocsV1Read,
    DocsV2Read,
    FdrAPI,
    migrateDocsDbDefinition
} from "@fern-api/fdr-sdk";
import type { AuthType } from "@prisma/client";
import type { Pool } from "pg";
import { DomainNotRegisteredError } from "../errors";
import { verifyDocsServiceJWT } from "../utils/jwt";
import { getPresignedDocsAssetsDownloadUrl } from "../utils/s3";
import { readBufferAsync } from "../utils/serde";

export { DocsV2Read };

export async function getDocsFields(
    request: DocsV2Read.GetDocsFieldsRequest,
    pool: Pool,
    authHeader: string | undefined
): Promise<DocsV2Read.GetDocsFieldsResponse> {
    const { domain, fields } = request;

    // Load docs definition from database
    const dbDocs = await loadDocsForURLFromDatabase(domain, pool);

    if (dbDocs == null) {
        throw new DomainNotRegisteredError();
    }

    // Verify the service JWT from docs-server
    await verifyDocsServiceJWT(authHeader);

    const response: DocsV2Read.GetDocsFieldsResponse = {
        domain,
        baseUrl: undefined,
        filesV2: undefined,
        apisV2: undefined,
        apis: undefined,
        pages: undefined,
        jsFiles: undefined,
        config: undefined,
        root: undefined
    };

    // Only load and convert the fields that were requested
    const fieldSet = new Set(fields);
    const { DocsDefinitionField } = DocsV2Read;

    if (fieldSet.has(DocsDefinitionField.BaseUrl)) {
        response.baseUrl = {
            domain: dbDocs.domain,
            basePath: dbDocs.path.trim() === "" ? undefined : dbDocs.path.trim()
        };
    }

    if (fieldSet.has(DocsDefinitionField.FilesV2)) {
        response.filesV2 = await getFilesV2(dbDocs.docsDefinition, dbDocs.hasPublicS3Assets);
    }

    if (fieldSet.has(DocsDefinitionField.ApisV2) || fieldSet.has(DocsDefinitionField.Apis)) {
        const apiDefinitions = await fetchApiDefinitions(
            dbDocs.docsDefinition.referencedApis,
            pool,
            fieldSet.has(DocsDefinitionField.Apis),
            fieldSet.has(DocsDefinitionField.ApisV2)
        );
        if (fieldSet.has(DocsDefinitionField.ApisV2)) {
            response.apisV2 = apiDefinitions.apiV2Definitions;
        }
        if (fieldSet.has(DocsDefinitionField.Apis)) {
            response.apis = apiDefinitions.apiV1Definitions;
        }
    }

    if (fieldSet.has(DocsDefinitionField.Pages)) {
        response.pages = dbDocs.docsDefinition.pages;
    }

    if (fieldSet.has(DocsDefinitionField.JsFiles)) {
        response.jsFiles = dbDocs.docsDefinition.jsFiles;
    }

    if (fieldSet.has(DocsDefinitionField.Config)) {
        response.config = convertDbDocsConfigToRead({ dbShape: dbDocs.docsDefinition.config });
    }

    if (fieldSet.has(DocsDefinitionField.Root)) {
        // The root is stored directly in the config - we just return it as-is
        // since it's already in the correct format (navigationV1.RootNode)
        response.root = dbDocs.docsDefinition.config.root;
    }

    return response;
}

interface LoadDocsDefinitionByUrlResponse {
    orgId: FdrAPI.OrgId;
    domain: string;
    path: string;
    docsDefinition: DocsV1Db.DocsDefinitionDb.V3;
    docsConfigInstanceId: string | null;
    authType: AuthType;
    hasPublicS3Assets: boolean;
}

async function loadDocsForURLFromDatabase(
    domain: string,
    pool: Pool
): Promise<LoadDocsDefinitionByUrlResponse | undefined> {
    const result = await pool.query(
        `SELECT "orgID", "domain", "path", "docsDefinition", "docsConfigInstanceId",
                "authType", "hasPublicS3Assets"
         FROM "DocsV2"
         WHERE "domain" = $1
         ORDER BY "updatedTime" DESC
         LIMIT 1`,
        [domain]
    );

    if (result.rows.length === 0) {
        return undefined;
    }

    const row = result.rows[0];
    return {
        orgId: FdrAPI.OrgId(row.orgID),
        domain: row.domain,
        path: row.path,
        docsDefinition: migrateDocsDbDefinition(await readBufferAsync(row.docsDefinition)),
        docsConfigInstanceId: row.docsConfigInstanceId,
        authType: row.authType as AuthType,
        hasPublicS3Assets: row.hasPublicS3Assets
    };
}

async function fetchApiDefinitions(
    referencedApis: string[],
    pool: Pool,
    loadV1: boolean,
    loadV2: boolean
): Promise<{
    apiV1Definitions: Record<string, APIV1Read.ApiDefinition>;
    apiV2Definitions: Record<string, FdrAPI.api.latest.ApiDefinition>;
}> {
    if (referencedApis.length === 0 || (!loadV1 && !loadV2)) {
        return {
            apiV1Definitions: {},
            apiV2Definitions: {}
        };
    }

    const promises: Promise<any>[] = [];

    if (loadV1) {
        promises.push(
            pool.query(
                `SELECT "apiDefinitionId", "definition"
                 FROM "ApiDefinitionsV2"
                 WHERE "apiDefinitionId" = ANY($1::text[])`,
                [referencedApis]
            )
        );
    } else {
        promises.push(Promise.resolve({ rows: [] }));
    }

    if (loadV2) {
        promises.push(
            pool.query(
                `SELECT "apiDefinitionId", "definition"
                 FROM "ApiDefinitionsLatest"
                 WHERE "apiDefinitionId" = ANY($1::text[])`,
                [referencedApis]
            )
        );
    } else {
        promises.push(Promise.resolve({ rows: [] }));
    }

    const [apiV1Result, apiV2Result] = await Promise.all(promises);

    const apiV1Definitions: Record<string, APIV1Read.ApiDefinition> = {};
    for (const row of apiV1Result.rows) {
        const apiDefinitionJson = (await readBufferAsync(row.definition)) as APIV1Db.DbApiDefinition;
        apiV1Definitions[row.apiDefinitionId] = convertDbAPIDefinitionToRead(apiDefinitionJson);
    }

    const apiV2Definitions: Record<string, FdrAPI.api.latest.ApiDefinition> = {};
    for (const row of apiV2Result.rows) {
        apiV2Definitions[row.apiDefinitionId] = (await readBufferAsync(
            row.definition
        )) as FdrAPI.api.latest.ApiDefinition;
    }

    return {
        apiV1Definitions,
        apiV2Definitions
    };
}

async function getFilesV2(
    docsDbDefinition: DocsV1Db.DocsDefinitionDb.V3,
    usesPublicS3: boolean
): Promise<Record<string, DocsV1Read.File_>> {
    const promisedFiles = Object.entries(docsDbDefinition.files).map(
        async ([fileId, fileDbInfo]): Promise<[string, DocsV1Read.File_]> => {
            const presignedUrl = await getPresignedDocsAssetsDownloadUrl({
                key: fileDbInfo.s3Key,
                isPrivate: !usesPublicS3
            });

            const readFile: DocsV1Read.File_ =
                fileDbInfo.type === "image"
                    ? {
                          type: "image",
                          url: DocsV1Read.Url(presignedUrl),
                          width: fileDbInfo.width,
                          height: fileDbInfo.height,
                          blurDataUrl: fileDbInfo.blurDataUrl,
                          alt: fileDbInfo.alt
                      }
                    : { type: "url", url: DocsV1Read.Url(presignedUrl) };

            return [fileId, readFile];
        }
    );

    return Object.fromEntries(await Promise.all(promisedFiles));
}
