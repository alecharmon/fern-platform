import "server-only";

import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import archiver from "archiver";
import { createReadStream } from "fs";
import fs from "fs/promises";
import path from "path";
import type { Readable } from "stream";

import { getS3Client } from "@/app/services/s3";

/**
 * Get the onboarding assets S3 bucket name from environment
 */
function getOnboardingAssetsBucketName(): string {
    if (process.env.ONBOARDING_ASSETS_S3_BUCKET_NAME == null) {
        throw new Error("ONBOARDING_ASSETS_S3_BUCKET_NAME is not defined in the environment");
    }
    return process.env.ONBOARDING_ASSETS_S3_BUCKET_NAME;
}

/**
 * Clean a filename for safe S3 storage
 */
function cleanFileName(fileName: string): string {
    return fileName.replaceAll(" ", "_").replaceAll("/", "-");
}

/**
 * Service for managing onboarding assets in S3
 */
export const OnboardS3Service = {
    /**
     * Generate a presigned upload URL for uploading assets to S3
     */
    async generateUploadUrl({
        organizationId,
        contentType,
        docsSite,
        fileName,
        fileHash
    }: {
        organizationId: string;
        contentType: string;
        docsSite?: string;
        fileName?: string;
        fileHash?: string;
    }): Promise<{
        uploadUrl: string;
        assetUrl: string;
        key: string;
    }> {
        const timestamp = new Date().toISOString();

        // Build the S3 key path based on provided parameters
        const pathParts = ["onboarding-assets", organizationId];

        if (docsSite != null) {
            pathParts.push(docsSite);
        }

        pathParts.push(timestamp);

        // Use fileHash if provided, otherwise use timestamp-based unique identifier
        const uniqueIdentifier = fileHash ?? `${timestamp}-${Math.random().toString(36).substring(2, 15)}`;

        // Add filename if provided, otherwise use a generic name
        const finalFileName = fileName != null ? cleanFileName(fileName) : `asset-${uniqueIdentifier}`;

        pathParts.push(finalFileName);

        const key = pathParts.join("/");

        // Create a pre-signed URL for uploading to S3
        const s3Client = getS3Client();
        const bucketName = getOnboardingAssetsBucketName();

        const putCommand = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            ContentType: contentType
        });

        const uploadUrl = await getSignedUrl(s3Client, putCommand, {
            expiresIn: 60 * 10 // 10 minutes expiry
        });

        // Generate a presigned GET URL for accessing the asset after upload
        const getCommand = new GetObjectCommand({
            Bucket: bucketName,
            Key: key
        });

        const assetUrl = await getSignedUrl(s3Client, getCommand, {
            expiresIn: 60 * 60 * 24 * 7 // 7 days expiry (maximum allowed)
        });

        return {
            uploadUrl,
            assetUrl,
            key
        };
    },

    /**
     * Check if an object exists in S3
     */
    async checkIfExists({ key }: { key: string }): Promise<boolean> {
        try {
            const s3Client = getS3Client();
            const bucketName = getOnboardingAssetsBucketName();

            await s3Client.send(
                new HeadObjectCommand({
                    Bucket: bucketName,
                    Key: key
                })
            );

            return true;
        } catch (error: any) {
            if (error.name === "NotFound" || error.name === "NoSuchKey") {
                return false;
            }
            throw error;
        }
    },

    /**
     * Generate a presigned download URL for an existing S3 object
     */
    async generateDownloadUrl({
        key,
        expiresIn = 60 * 60 * 24 * 7 // Default: 7 days (maximum allowed)
    }: {
        key: string;
        expiresIn?: number;
    }): Promise<string> {
        const s3Client = getS3Client();
        const bucketName = getOnboardingAssetsBucketName();

        const getCommand = new GetObjectCommand({
            Bucket: bucketName,
            Key: key
        });

        return await getSignedUrl(s3Client, getCommand, { expiresIn });
    },

    /**
     * Upload a file directly to S3
     */
    async uploadFile({
        key,
        filePath,
        contentType
    }: {
        key: string;
        filePath: string;
        contentType: string;
    }): Promise<void> {
        const s3Client = getS3Client();
        const bucketName = getOnboardingAssetsBucketName();

        const fileContent = await fs.readFile(filePath);

        const putCommand = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: fileContent,
            ContentType: contentType
        });

        await s3Client.send(putCommand);
    },

    /**
     * Upload a buffer directly to S3
     */
    async uploadBuffer({
        key,
        buffer,
        contentType
    }: {
        key: string;
        buffer: Buffer;
        contentType: string;
    }): Promise<void> {
        const s3Client = getS3Client();
        const bucketName = getOnboardingAssetsBucketName();

        const putCommand = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: buffer,
            ContentType: contentType
        });

        await s3Client.send(putCommand);
    },

    /**
     * Zip a directory and upload it to S3, returning the download URL
     */
    async zipAndUploadDirectory({ directoryPath, key }: { directoryPath: string; key: string }): Promise<{
        downloadUrl: string;
        key: string;
    }> {
        const s3Client = getS3Client();
        const bucketName = getOnboardingAssetsBucketName();

        // Create a zip archive
        const archive = archiver("zip", {
            zlib: { level: 9 } // Maximum compression
        });

        // Create a buffer to collect the zip data
        const chunks: Buffer[] = [];

        await new Promise<void>((resolve, reject) => {
            archive.on("data", (chunk) => chunks.push(chunk));
            archive.on("end", () => resolve());
            archive.on("error", (err) => reject(err));

            // Add the directory to the archive
            archive.directory(directoryPath, false);

            // Finalize the archive
            archive.finalize();
        });

        const zipBuffer = Buffer.concat(chunks);

        // Upload the zip to S3
        const putCommand = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: zipBuffer,
            ContentType: "application/zip"
        });

        await s3Client.send(putCommand);

        // Generate download URL
        const downloadUrl = await this.generateDownloadUrl({ key });

        return {
            downloadUrl,
            key
        };
    },

    /**
     * Retrieve a file from S3 and save it locally
     */
    async downloadFile({ key, destinationPath }: { key: string; destinationPath: string }): Promise<void> {
        const s3Client = getS3Client();
        const bucketName = getOnboardingAssetsBucketName();

        const getCommand = new GetObjectCommand({
            Bucket: bucketName,
            Key: key
        });

        const response = await s3Client.send(getCommand);

        if (response.Body == null) {
            throw new Error(`No body returned for S3 object: ${key}`);
        }

        // Ensure destination directory exists
        await fs.mkdir(path.dirname(destinationPath), { recursive: true });

        // Write the S3 object body to the destination file
        const bodyStream = response.Body as Readable;
        const fileStream = createReadStream(destinationPath);

        await new Promise<void>((resolve, reject) => {
            bodyStream.pipe(fileStream);
            bodyStream.on("end", () => resolve());
            bodyStream.on("error", (err) => reject(err));
            fileStream.on("error", (err) => reject(err));
        });
    }
};
