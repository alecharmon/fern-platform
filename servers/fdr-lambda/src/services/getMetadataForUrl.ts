/** biome-ignore-all lint/suspicious/noConsole: lambda logging */

import type { Pool } from "pg";
import { InvalidUrlError } from "../errors";

export interface DocsUrlMetadata {
    url: string;
    org: string;
    isPreviewUrl: boolean;
    gitUrl?: string;
    enableAlgoliaOnPreview: boolean;
    postmanCollectionId?: string;
}

export async function getMetadataForUrl(url: string, pool: Pool, basepath?: string): Promise<DocsUrlMetadata | null> {
    let parsedUrl: URL;
    try {
        let urlWithProtocol = url;
        if (!/^https?:\/\//i.test(url)) {
            urlWithProtocol = "https://" + url;
        }
        parsedUrl = new URL(urlWithProtocol);
    } catch (error) {
        throw new InvalidUrlError(url, error as Error);
    }
    const hostname = parsedUrl.hostname;

    const query =
        basepath != null
            ? {
                  text: `SELECT "orgID", "isPreview", "domain", "path", "githubUrl"
               FROM "DocsV2"
               WHERE "domain" = $1 AND "path" = $2`,
                  values: [hostname, basepath]
              }
            : {
                  text: `SELECT "orgID", "isPreview", "domain", "path", "githubUrl"
               FROM "DocsV2"
               WHERE "domain" = $1
               ORDER BY "updatedTime" DESC
               LIMIT 1`,
                  values: [hostname]
              };
    console.log(
        `[getMetadataForUrl] Querying metadata for hostname=${hostname}${basepath != null ? `, basepath=${basepath}` : ", no basepath"}`
    );

    const result = await pool.query(query.text, query.values);

    if (result.rows.length === 0) {
        console.warn(
            `[getMetadataForUrl] No metadata found for hostname=${hostname}${basepath != null ? `, basepath=${basepath}` : ""}`
        );
        return null;
    }

    console.log(
        `[getMetadataForUrl] Found metadata for hostname=${hostname}${basepath != null ? `, basepath=${basepath}` : ""}, org=${result.rows[0].orgID}`
    );

    const whitelistResult = await pool.query(
        `SELECT "domain" FROM "algolia_preview_domain_whitelist" WHERE "domain" = $1 LIMIT 1`,
        [hostname]
    );

    const collectionQuery =
        basepath != null
            ? {
                  text: `SELECT "postmanCollectionId" FROM "docs_sites" WHERE "domain" = $1 AND "basepath" = $2 LIMIT 1`,
                  values: [hostname, basepath]
              }
            : {
                  text: `SELECT "postmanCollectionId" FROM "docs_sites" WHERE "domain" = $1 AND "basepath" = '' LIMIT 1`,
                  values: [hostname]
              };
    const collectionResult = await pool.query(collectionQuery.text, collectionQuery.values);

    const row = result.rows[0];
    return {
        url,
        org: row.orgID,
        isPreviewUrl: row.isPreview,
        gitUrl: row.githubUrl ?? undefined,
        enableAlgoliaOnPreview: whitelistResult.rows.length > 0,
        postmanCollectionId: collectionResult.rows[0]?.postmanCollectionId ?? undefined
    };
}
