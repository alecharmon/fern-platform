import { unstable_cache } from "next/cache";
import { cache } from "react";

import { isLocal } from "./isLocal";
import { isSelfHosted } from "./isSelfHosted";
import {
  DynamicIRsByLanguage,
  loadDynamicIRFromS3,
} from "./loadDynamicIRFromS3";

export type DynamicIRsByAPI = Record<string, DynamicIRsByLanguage>;

export const loadDynamicIRWithUrl = cache(
  async ({
    orgId,
    apiName,
  }: {
    orgId: string;
    apiName: string;
  }): Promise<DynamicIRsByLanguage | undefined> => {
    return unstable_cache(
      async () => {
        // todo: support dynamic snippets in local dev
        if (isLocal()) {
          return undefined;
        }

        // todo: support dynamic snippets in self-hosted
        if (isSelfHosted()) {
          return undefined;
        }

        try {
          const response = await loadDynamicIRFromS3(
            orgId,
            apiName,
            getDynamicIRBucketName()
          );
          if (response != null && Object.keys(response).length > 0) {
            return response;
          }
        } catch (error) {
          console.error("Failed to load dynamic IR:", error);
        }

        return undefined;
      },
      [orgId, apiName],
      { tags: ["loadDynamicIRWithUrl", orgId, apiName] }
    )();
  }
);

function getDynamicIRBucketName() {
  return (
    process.env.DYNAMIC_IR_S3_BUCKET_NAME ??
    "fdr-prod-api-definition-source-files"
  );
}
