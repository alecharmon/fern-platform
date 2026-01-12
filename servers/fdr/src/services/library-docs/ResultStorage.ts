import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { FdrConfig } from "../../app";

const PRESIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

/**
 * Handles S3 operations for library docs generation.
 * The Lambda uploads IR directly; this class provides presigned URLs for download.
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

    async getPresignedDownloadUrl(s3Key: string): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: s3Key
        });

        return getSignedUrl(this.s3Client, command, {
            expiresIn: PRESIGNED_URL_EXPIRY_SECONDS
        });
    }

    /**
     * Fetch IR content directly from S3.
     */
    async getIRContent<T>(s3Key: string): Promise<T> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: s3Key
        });

        const response = await this.s3Client.send(command);
        if (response.Body == null) {
            throw new Error(`Failed to fetch IR from S3: empty body for key ${s3Key}`);
        }

        const bodyString = await response.Body.transformToString();
        return JSON.parse(bodyString) as T;
    }
}
