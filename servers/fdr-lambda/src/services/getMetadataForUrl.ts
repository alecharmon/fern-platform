import type { Pool } from "pg";
import { InvalidUrlError } from "../errors";

export interface DocsUrlMetadata {
    url: string;
    org: string;
    isPreviewUrl: boolean;
    gitUrl?: string;
    enableAlgoliaOnPreview: boolean;
}

export async function getMetadataForUrl(url: string, pool: Pool): Promise<DocsUrlMetadata | null> {
    // Parse the URL to get the hostname
    // Coerce URL by adding https:// prefix if missing (similar to ParsedBaseUrl in FDR)
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

    // Query the database for the docs metadata
    const result = await pool.query(
        `SELECT "orgID", "isPreview", "domain", "path", "githubUrl"
     FROM "DocsV2"
     WHERE "domain" = $1
     ORDER BY "updatedTime" DESC
     LIMIT 1`,
        [hostname]
    );

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
