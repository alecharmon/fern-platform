import type { DocsV2Read } from "@fern-api/fdr-sdk";

import { mongoClient, type UnzippedEditorDocument } from "./mongodb-client";

export class VisualEditorStorage {
    async storeFdrSnapshot(
        domain: string,
        branchName: string,
        fdrResponse: DocsV2Read.LoadDocsForUrlResponse
    ): Promise<void> {
        const uniqueRunId = crypto.randomUUID();
        const startTimestamp = Date.now();
        console.debug(`[VisualEditorStorage] Storing FDR for ${domain}:${branchName}`, {
            uniqueRunId,
            timestamp: startTimestamp
        });

        try {
            await mongoClient.set(domain, branchName, fdrResponse);
            const endTimestamp = Date.now();
            const duration = endTimestamp - startTimestamp;
            console.debug(`[VisualEditorStorage] FDR successfully stored for ${domain}:${branchName}`, {
                uniqueRunId,
                timestamp: endTimestamp,
                duration
            });
        } catch (error) {
            console.error(`[VisualEditorStorage] Failed to store FDR for ${domain}:${branchName}`, error);
            throw error;
        }
    }

    async getFdrSnapshot(domain: string, branchName: string): Promise<DocsV2Read.LoadDocsForUrlResponse | null> {
        const uniqueRunId = crypto.randomUUID();
        const startTimestamp = Date.now();
        console.debug(`[VisualEditorStorage] Retrieving FDR for ${domain}:${branchName}`, {
            uniqueRunId
        });

        try {
            const fdrResponse = await mongoClient.get(domain, branchName);
            const endTimestamp = Date.now();
            const duration = endTimestamp - startTimestamp;
            console.debug(`[VisualEditorStorage] FDR successfully retrieved for ${domain}:${branchName}`, {
                uniqueRunId,
                duration
            });
            return fdrResponse;
        } catch (error) {
            const endTimestamp = Date.now();
            const duration = endTimestamp - startTimestamp;
            console.error(`[VisualEditorStorage] Failed to retrieve FDR for ${domain}:${branchName}`, error, {
                uniqueRunId,
                duration
            });
            return null;
        }
    }

    async getDocumentsForBranches(branchNames: string[]): Promise<UnzippedEditorDocument[]> {
        try {
            const documents = await mongoClient.findDocumentsForBranches(branchNames);
            return documents;
        } catch (error) {
            console.error(
                `[VisualEditorStorage] Failed to retrieve documents for ${branchNames.length} branches`,
                error
            );
            return [];
        }
    }
}

export const visualEditorStorage: VisualEditorStorage = new VisualEditorStorage();
