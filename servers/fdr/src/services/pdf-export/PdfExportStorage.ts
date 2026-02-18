import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { FdrConfig } from "../../app/FdrConfig";

const UPLOAD_URL_EXPIRY_SECONDS = 60 * 60; // 1 hour
const DOWNLOAD_URL_EXPIRY_SECONDS = 12 * 60 * 60; // 12 hours

export interface PresignedDownloadUrl {
    url: string;
    expiresInSeconds: number;
}

export class PdfExportStorage {
    private s3Client: S3Client;
    public readonly bucketName: string;

    constructor(config: FdrConfig) {
        const s3Config = config.pdfExportS3;
        this.bucketName = s3Config.bucketName;
        this.s3Client = new S3Client({
            region: s3Config.bucketRegion,
            credentials: {
                accessKeyId: config.awsAccessKey,
                secretAccessKey: config.awsSecretKey
            },
            ...(s3Config.urlOverride && { endpoint: s3Config.urlOverride }),
            ...(s3Config.forcePathStyle && { forcePathStyle: s3Config.forcePathStyle })
        });
    }

    public async getPresignedDownloadUrl(s3Key: string): Promise<PresignedDownloadUrl> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: s3Key
        });
        const url = await getSignedUrl(this.s3Client, command, {
            expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS
        });
        return { url, expiresInSeconds: DOWNLOAD_URL_EXPIRY_SECONDS };
    }

    public async getPresignedUploadUrl(s3Key: string): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: s3Key,
            ContentType: "application/pdf"
        });
        return getSignedUrl(this.s3Client, command, {
            expiresIn: UPLOAD_URL_EXPIRY_SECONDS
        });
    }

    public getS3KeyForTask(taskId: string, docsUrl: string): string {
        const sanitizedDocsUrl = docsUrl.replace(/[^a-zA-Z0-9-]/g, "-");
        return `pdf-exports/${taskId}/${sanitizedDocsUrl}.pdf`;
    }
}
