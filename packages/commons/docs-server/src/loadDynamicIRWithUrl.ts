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
    apiNames,
  }: {
    orgId: string;
    apiNames: string[];
  }): Promise<DynamicIRsByAPI | undefined> => {
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

        const dynamicIRsByApi: DynamicIRsByAPI = {};

        for (const apiName of apiNames) {
          try {
            const response = await loadDynamicIRFromS3(
              orgId,
              apiName,
              getDynamicIRBucketName()
            );
            if (response != null) {
              dynamicIRsByApi[apiName] = response as DynamicIRsByLanguage;
            }
          } catch (error) {
            console.error("Failed to load dynamic IR:", error);
          }
        }

        if (Object.keys(dynamicIRsByApi).length > 0) {
          return dynamicIRsByApi;
        }

        return undefined;
      },
      [orgId],
      { tags: ["loadDynamicIRWithUrl", orgId] }
    )();
  }
);

function getDynamicIRBucketName() {
  return (
    process.env.DYNAMIC_IR_S3_BUCKET_NAME ??
    "fdr-prod-api-definition-source-files"
  );
}
