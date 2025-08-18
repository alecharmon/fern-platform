import "server-only";

import { cache } from "react";

import { FdrAPI } from "@fern-api/fdr-sdk";
import { getS3KeyForDynamicIr } from "@fern-api/fdr-sdk/docs";

import { getSignedUrl } from "./loadDocsDefinitionFromS3";

export type DynamicIRsByLanguage = Record<
  string,
  FdrAPI.api.v1.register.DynamicIr
>;

const generatorLanguages = [
  "typescript",
  "python",
  "java",
  "go",
  "php",
  "ruby",
  "csharp",
];

export const loadDynamicIRFromS3 = cache(
  async (
    orgName: string,
    apiName: string,
    docsBucketName: string
  ): Promise<DynamicIRsByLanguage | undefined> => {
    const dynamicIRsByLanguage: DynamicIRsByLanguage = {};
    try {
      for (const language of generatorLanguages) {
        const s3Key = getS3KeyForDynamicIr({
          orgName,
          apiName,
          language,
        });

        const signedUrl = await getSignedUrl({
          Bucket: docsBucketName,
          Key: s3Key,
          expiresIn: 60 * 60, // 1 hour
        });

        // cache with org name, not domain (?)
        const response = await fetch(signedUrl, {
          next: { tags: [orgName, apiName, language, "loadDynamicIRFromS3"] },
        });

        if (response.ok) {
          console.debug(
            `Successfully loaded dynamic IR from S3 for ${s3Key}: ${signedUrl}`
          );
          const json = await response.json();
          dynamicIRsByLanguage[language] =
            json as FdrAPI.api.v1.register.DynamicIr;
        } else {
          console.debug(
            `Failed to load dynamic IR for ${s3Key} from S3. Status: ${response.status}. Error: ${await response.text()}`
          );
        }
      }

      if (Object.keys(dynamicIRsByLanguage).length > 0) {
        return dynamicIRsByLanguage;
      }

      return undefined;
    } catch (error) {
      console.error("Error loading dynamic IR from S3:", error);
      return undefined;
    }
  }
);
