import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { FdrConfig } from "../../app";

const LIBRARY_DOCS_RESULTS_PREFIX = "library-docs-results";
const PRESIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

/**
 * Internal storage format for library docs results.
 * This is stored in S3 and consumed by FDR during docs registration.
 */
export interface StoredResult {
    jobId: string;
    pages: Record<string, string>; // pageId -> markdown content
    navigation: StoredNavigation;
    metadata: StoredMetadata;
}

export interface StoredNavigation {
    title: string;
    slug: string;
    children: StoredNavigationChild[];
}

export type StoredNavigationChild =
    | { type: "page"; title: string; slug: string; pageId: string }
    | { type: "section"; title: string; slug: string; children: StoredNavigationChild[] };

export interface StoredMetadata {
    sourceUrl: string;
    branch?: string;
    commit?: string;
    parsedAt: string;
    parserVersion: string;
}

/**
 * Handles S3 storage for library docs generation results.
 */
export class ResultStorage {
    private s3Client: S3Client;
    private bucketName: string;

    constructor(config: FdrConfig) {
        this.s3Client = new S3Client({
            ...(config.libraryDocsS3.urlOverride != null ? { endpoint: config.libraryDocsS3.urlOverride } : {}),
            region: config.libraryDocsS3.bucketRegion,
            forcePathStyle: config.libraryDocsS3.forcePathStyle ?? false,
            credentials: {
                accessKeyId: config.awsAccessKey,
                secretAccessKey: config.awsSecretKey
            }
        });
        this.bucketName = config.libraryDocsS3.bucketName;
    }

    async upload(result: StoredResult): Promise<string> {
        const key = this.constructKey(result.jobId);

        await this.s3Client.send(
            new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: JSON.stringify(result),
                ContentType: "application/json"
            })
        );

        return key;
    }

    async getPresignedDownloadUrl(s3Key: string): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: s3Key
        });

        return getSignedUrl(this.s3Client, command, {
            expiresIn: PRESIGNED_URL_EXPIRY_SECONDS
        });
    }

    async download(s3Key: string): Promise<StoredResult> {
        const response = await this.s3Client.send(
            new GetObjectCommand({
                Bucket: this.bucketName,
                Key: s3Key
            })
        );

        const body = await response.Body?.transformToString();
        if (!body) {
            throw new Error(`Empty response body for S3 key: ${s3Key}`);
        }

        return JSON.parse(body) as StoredResult;
    }

    private constructKey(jobId: string): string {
        return `${LIBRARY_DOCS_RESULTS_PREFIX}/${jobId}.json`;
    }
}
