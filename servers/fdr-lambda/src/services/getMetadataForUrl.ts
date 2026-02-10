import type { Pool } from "pg";
import { InvalidUrlError } from "../errors";

export interface DocsUrlMetadata {
    url: string;
    org: string;
    isPreviewUrl: boolean;
    gitUrl?: string;
    enableAlgoliaOnPreview: boolean;
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
    const result = await pool.query(query.text, query.values);

    if (result.rows.length === 0) {
        return null;
    }

    const whitelistResult = await pool.query(
        `SELECT "domain" FROM "algolia_preview_domain_whitelist" WHERE "domain" = $1 LIMIT 1`,
        [hostname]
    );

    const row = result.rows[0];
    return {
        url,
        org: row.orgID,
        isPreviewUrl: row.isPreview,
        gitUrl: row.githubUrl ?? undefined,
        enableAlgoliaOnPreview: whitelistResult.rows.length > 0
    };
}
