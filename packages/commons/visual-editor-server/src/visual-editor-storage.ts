import type { DocsV2Read } from "@fern-api/fdr-sdk";

import { type VisualEditorDocument, mongoClient } from "./mongodb-client";

export class VisualEditorStorage {
  async storeFdrSnapshot(
    domain: string,
    branchName: string,
    fdrResponse: DocsV2Read.LoadDocsForUrlResponse
  ): Promise<void> {
    console.log(
      `[VisualEditorStorage] Storing FDR for ${domain}:${branchName}`
    );

    try {
      await mongoClient.set(domain, branchName, fdrResponse);
    } catch (error) {
      console.error(
        `[VisualEditorStorage] Failed to store FDR for ${domain}:${branchName}`,
        error
      );
      throw error;
    }
  }

  async getFdrSnapshot(
    domain: string,
    branchName: string
  ): Promise<DocsV2Read.LoadDocsForUrlResponse | null> {
    console.log(
      `[VisualEditorStorage] Retrieving FDR for ${domain}:${branchName}`
    );

    try {
      const fdrResponse = await mongoClient.get(domain, branchName);
      return fdrResponse;
    } catch (error) {
      console.error(
        `[VisualEditorStorage] Failed to retrieve FDR for ${domain}:${branchName}`,
        error
      );
      return null;
    }
  }

  async getDocumentsForBranches(
    branchNames: string[]
  ): Promise<VisualEditorDocument[]> {
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

export const visualEditorStorage: VisualEditorStorage =
  new VisualEditorStorage();
