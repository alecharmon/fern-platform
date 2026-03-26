import type winston from "winston";

import type { FdrApplication } from "../../app";
import { ParsedBaseUrl } from "../../util/ParsedBaseUrl";

const CONCURRENCY_LIMIT = 5;

export interface DeleteDocsService {
    deleteDocsSite(params: { url: ParsedBaseUrl; orgId: string; isPreview: boolean }): Promise<void>;
    deleteAllDocsSitesForOrg(params: { orgId: string }): Promise<{ deletedCount: number }>;
}

export class DeleteDocsServiceImpl implements DeleteDocsService {
    private readonly logger: winston.Logger;

    constructor(private readonly app: FdrApplication) {
        this.logger = app.logger;
    }

    /**
     * Deletes a single docs site: S3 assets, all DocsV2 records sharing the same
     * docsConfigInstanceId, DocsSite record, Redis cache, and edge cache.
     */
    public async deleteDocsSite({
        url,
        orgId,
        isPreview
    }: {
        url: ParsedBaseUrl;
        orgId: string;
        isPreview: boolean;
    }): Promise<void> {
        this.logger.info(`[DeleteDocsService] Deleting docs site for ${url.getFullUrl()} (preview=${isPreview})`);

        const domain = url.hostname;
        const { deletedCount } = await this.app.services.s3.deleteDocsAssetsByDomain({ domain });
        this.logger.info(`[DeleteDocsService] Deleted ${deletedCount} S3 objects for domain ${domain}`);

        // Delete all DocsV2 records sharing the same docsConfigInstanceId (including custom domains)
        const { deletedUrls } = await this.app.dao.docsV2().deleteDocsSite({ url });

        await this.app.dao.docsSite().deleteDocsSite({
            orgId,
            domain: url.hostname,
            basepath: url.path
        });

        // Invalidate Redis cache and revalidate edge cache for all deleted URLs
        for (const deletedUrl of deletedUrls) {
            const siblingUrl = ParsedBaseUrl.parse(
                deletedUrl.path && deletedUrl.path !== "" ? `${deletedUrl.domain}${deletedUrl.path}` : deletedUrl.domain
            );
            await this.app.docsDefinitionCache.invalidateCache(siblingUrl.toURL());

            try {
                await this.app.services.revalidator.revalidate({
                    baseUrl: siblingUrl,
                    app: this.app,
                    authHeader: ""
                });
            } catch (e) {
                this.logger.warn(`[DeleteDocsService] Error revalidating cache for ${siblingUrl.getFullUrl()}`, e);
            }
        }
    }

    /**
     * Deletes ALL docs sites associated with an org (including preview and archived sites).
     * Used during org deletion to clean up all resources.
     * Processes deletions in batches to avoid resource exhaustion.
     */
    public async deleteAllDocsSitesForOrg({ orgId }: { orgId: string }): Promise<{ deletedCount: number }> {
        const allDocs = await this.app.dao.docsV2().listAllDocsUrlsForOrg(orgId);
        this.logger.info(`[DeleteDocsService] Found ${allDocs.length} docs sites for org ${orgId}`);

        if (allDocs.length === 0) {
            return { deletedCount: 0 };
        }

        let deletedCount = 0;

        // Process in batches of CONCURRENCY_LIMIT to avoid resource exhaustion
        for (let i = 0; i < allDocs.length; i += CONCURRENCY_LIMIT) {
            const batch = allDocs.slice(i, i + CONCURRENCY_LIMIT);
            const results = await Promise.allSettled(
                batch.map(async (doc) => {
                    const url = ParsedBaseUrl.parse(
                        doc.path && doc.path !== "" ? `${doc.domain}${doc.path}` : doc.domain
                    );
                    await this.deleteDocsSite({
                        url,
                        orgId,
                        isPreview: doc.isPreview
                    });
                })
            );

            for (const result of results) {
                if (result.status === "fulfilled") {
                    deletedCount++;
                } else {
                    this.logger.error(
                        `[DeleteDocsService] Failed to delete a docs site for org ${orgId}:`,
                        result.reason
                    );
                }
            }
        }

        this.logger.info(`[DeleteDocsService] Deleted ${deletedCount}/${allDocs.length} docs sites for org ${orgId}`);

        return { deletedCount };
    }
}
