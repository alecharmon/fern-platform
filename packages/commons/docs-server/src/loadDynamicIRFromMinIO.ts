import "server-only";

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { APIV1Write, FdrAPI } from "@fern-api/fdr-sdk";
import { getS3KeyForDynamicIr } from "@fern-api/fdr-sdk/docs";
import { cache } from "react";

import type { DynamicIRsByLanguage } from "./loadDynamicIRFromS3";

export const loadDynamicIRFromMinIO = cache(
    async (
        orgName: string,
        apiName: string,
        snippetsConfig: APIV1Write.SnippetsConfig,
        minioEndpoint: string
    ): Promise<DynamicIRsByLanguage | undefined> => {
        const dynamicIRsByLanguage: DynamicIRsByLanguage = {};

        const accessKeyId = process.env.MINIO_ACCESS_KEY ?? process.env.NEXT_PUBLIC_MINIO_ACCESS_KEY;
        const secretAccessKey = process.env.MINIO_SECRET_KEY ?? process.env.NEXT_PUBLIC_MINIO_SECRET_KEY;
        const bucketName =
            process.env.NEXT_PUBLIC_DYNAMIC_IR_BUCKET_NAME ??
            process.env.MINIO_BUCKET_NAME ??
            process.env.NEXT_PUBLIC_DOCS_DOMAIN;

        if (!accessKeyId || !secretAccessKey) {
            console.error("Missing MinIO credentials for dynamic IR loading");
            return undefined;
        }

        if (!bucketName) {
            console.error("Missing MinIO bucket name for dynamic IR loading");
            return undefined;
        }

        const minIOClient = new S3Client({
            endpoint: minioEndpoint,
            credentials: {
                accessKeyId,
                secretAccessKey
            },
            forcePathStyle: true,
            region: "us-east-1"
        });

        try {
            for (const [sdkLanguage, packageName] of Object.entries(snippetsConfig)) {
                const language = sdkLanguage.replace("Sdk", "");

                if (!packageName) {
                    continue;
                }

                console.debug(`Fetching dynamic IR from MinIO for ${orgName}:${apiName}:${language}...`);

                const s3Key = getS3KeyForDynamicIr({
                    orgName,
                    apiName,
                    language
                });

                try {
                    const command = new GetObjectCommand({
                        Bucket: bucketName,
                        Key: s3Key
                    });

                    const response = await minIOClient.send(command);

                    if (!response.Body) {
                        console.debug(`Empty response body from MinIO for ${s3Key}`);
                        continue;
                    }

                    const bodyContents = await response.Body.transformToString();
                    const json = JSON.parse(bodyContents);
                    dynamicIRsByLanguage[language] = json as FdrAPI.api.v1.register.DynamicIr;
                    console.debug(`Successfully loaded dynamic IR from MinIO for ${s3Key}`);
                } catch (error) {
                    console.debug(`Failed to load dynamic IR for ${s3Key} from MinIO:`, error);
                }
            }

            if (Object.keys(dynamicIRsByLanguage).length > 0) {
                return dynamicIRsByLanguage;
            }

            return undefined;
        } catch (error) {
            console.error("Error loading dynamic IR from MinIO:", error);
            return undefined;
        }
    }
);
