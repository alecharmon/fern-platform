/** biome-ignore-all lint/suspicious/noConsole: i am too lazy to install a real logger here right now */

import type { FdrLambda } from "@fern-api/fdr-lambda-sdk";
import {
    type APIV1Db,
    type APIV1Read,
    convertDbAPIDefinitionToRead,
    convertDocsDefinitionToRead,
    type DocsV1Db,
    DocsV1Read,
    type DocsV2Read,
    FdrAPI,
    migrateDocsDbDefinition
} from "@fern-api/fdr-sdk";
import type { AuthType } from "@prisma/client";
import type { Pool } from "pg";
import { DomainNotRegisteredError } from "../errors";
import { checkUserBelongsToOrg } from "../utils/auth";
import { getPresignedDocsAssetsDownloadUrl, storeDocsDefinitionInS3 } from "../utils/s3";
import { readBuffer } from "../utils/serde";

export async function ensureDocsInS3(
    url: URL,
    pool: Pool,
    authHeader: string | undefined
): Promise<FdrLambda.docs.v2.read.EnsureDocsInS3Response> {
    console.log(`[ensureDocsInS3] Loading docs from database for hostname: ${url.hostname}`);

    const dbDocs = await loadDocsForURLFromDatabase(url, pool);

    if (dbDocs == null) {
        throw new DomainNotRegisteredError();
    }

    // Check authorization - user must belong to the org that owns these docs
    await checkUserBelongsToOrg({
        authHeader,
        orgId: dbDocs.orgId
    });

    console.log(`[ensureDocsInS3] Converting docs definition to read format for domain: ${url.hostname}`);

    // Fetch API definitions referenced by the docs
    const apiDefinitions = await fetchApiDefinitions(dbDocs.docsDefinition.referencedApis, pool);

    // Convert docs definition to read format
    const filesV2 = await getFilesV2(dbDocs.docsDefinition, dbDocs.hasPublicS3Assets);

    const definition = convertDocsDefinitionToRead({
        docsDbDefinition: dbDocs.docsDefinition,
        filesV2,
        apis: apiDefinitions.apiV1Definitions,
        apisV2: apiDefinitions.apiV2Definitions,
        id: dbDocs.docsConfigInstanceId != null ? DocsV1Read.DocsConfigId(dbDocs.docsConfigInstanceId) : undefined
    });

    const docsResponse: DocsV2Read.LoadDocsForUrlResponse = {
        orgId: dbDocs.orgId,
        baseUrl: {
            domain: dbDocs.domain,
            basePath: dbDocs.path.trim() === "" ? undefined : dbDocs.path.trim()
        },
        definition,
        lightModeEnabled: definition.config.colorsV3?.type !== "dark"
    };

    console.log(`[ensureDocsInS3] Storing docs definition in S3 for domain: ${url.hostname}`);

    // Store the docs definition in S3 idempotently
    await storeDocsDefinitionInS3(url.hostname, docsResponse);

    // Construct the S3 URL (non-presigned)
    const bucketName = process.env.DB_DOCS_DEFINITION_BUCKET_NAME || "";
    const s3Key = `${url.hostname}/v1/fdr.json`;
    const s3Url = `https://${bucketName}.s3.amazonaws.com/${s3Key}`;

    console.log(`[ensureDocsInS3] Successfully stored docs in S3, returning URL: ${s3Url}`);

    return {
        s3Url: DocsV1Read.Url(s3Url),
        orgId: dbDocs.orgId
    };
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

async function loadDocsForURLFromDatabase(url: URL, pool: Pool): Promise<LoadDocsDefinitionByUrlResponse | undefined> {
    const result = await pool.query(
        `SELECT "orgID", "domain", "path", "docsDefinition", "docsConfigInstanceId",
                "authType", "hasPublicS3Assets"
         FROM "DocsV2"
         WHERE "domain" = $1
         ORDER BY "updatedTime" DESC
         LIMIT 1`,
        [url.hostname]
    );

    if (result.rows.length === 0) {
        return undefined;
    }

    const row = result.rows[0];
    return {
        orgId: FdrAPI.OrgId(row.orgID),
        domain: row.domain,
        path: row.path,
        docsDefinition: migrateDocsDbDefinition(readBuffer(row.docsDefinition)),
        docsConfigInstanceId: row.docsConfigInstanceId,
        authType: row.authType as AuthType,
        hasPublicS3Assets: row.hasPublicS3Assets
    };
}

async function fetchApiDefinitions(
    referencedApis: string[],
    pool: Pool
): Promise<{
    apiV1Definitions: Record<string, APIV1Read.ApiDefinition>;
    apiV2Definitions: Record<string, FdrAPI.api.latest.ApiDefinition>;
}> {
    if (referencedApis.length === 0) {
        return {
            apiV1Definitions: {},
            apiV2Definitions: {}
        };
    }

    // Fetch API definitions from both tables
    const [apiV1Result, apiV2Result] = await Promise.all([
        pool.query(
            `SELECT "apiDefinitionId", "definition"
             FROM "ApiDefinitionsV2"
             WHERE "apiDefinitionId" = ANY($1::text[])`,
            [referencedApis]
        ),
        pool.query(
            `SELECT "apiDefinitionId", "definition"
             FROM "ApiDefinitionsLatest"
             WHERE "apiDefinitionId" = ANY($1::text[])`,
            [referencedApis]
        )
    ]);

    const apiV1Definitions: Record<string, APIV1Read.ApiDefinition> = {};
    for (const row of apiV1Result.rows) {
        const apiDefinitionJson = readBuffer(row.definition) as APIV1Db.DbApiDefinition;
        apiV1Definitions[row.apiDefinitionId] = convertDbAPIDefinitionToRead(apiDefinitionJson);
    }

    const apiV2Definitions: Record<string, FdrAPI.api.latest.ApiDefinition> = {};
    for (const row of apiV2Result.rows) {
        apiV2Definitions[row.apiDefinitionId] = readBuffer(row.definition) as FdrAPI.api.latest.ApiDefinition;
    }

    return {
        apiV1Definitions,
        apiV2Definitions
    };
}

async function getFilesV2(
    docsDbDefinition: DocsV1Db.DocsDefinitionDb.V3,
    usesPublicS3: boolean
): Promise<Record<DocsV1Read.FileId, DocsV1Read.File_>> {
    const promisedFiles = Object.entries(docsDbDefinition.files).map(
        async ([fileId, fileDbInfo]): Promise<[DocsV1Read.FileId, DocsV1Read.File_]> => {
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

            return [DocsV1Read.FileId(fileId), readFile];
        }
    );

    return Object.fromEntries(await Promise.all(promisedFiles));
}
