import "server-only";

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

import { getS3Client } from "@/app/services/s3";

import type { MaybeErrorResponse } from "../../utils/MaybeErrorResponse";
import { getOnboardingAssetsBucketName } from "./bucket";

export default async function generateOnboardingAssetUploadUrlHandler({
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
}): Promise<
    MaybeErrorResponse<{
        uploadUrl: string;
        assetUrl: string;
        key: string;
    }>
> {
    try {
        // Generate a unique key for the uploaded asset
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
            expiresIn: 60 * 10
        }); // 10 minutes expiry

        // Generate a presigned GET URL for accessing the asset after upload
        // Since the bucket has blockPublicAccess: BLOCK_ALL, direct S3 URLs won't work
        const getCommand = new GetObjectCommand({
            Bucket: bucketName,
            Key: key
        });

        const assetUrl = await getSignedUrl(s3Client, getCommand, {
            expiresIn: 60 * 60 * 24 * 7
        }); // 7 days expiry (maximum allowed)

        return {
            data: {
                uploadUrl,
                assetUrl,
                key
            }
        };
    } catch (error) {
        console.error("Error creating pre-signed URL for onboarding asset:", error);
        return {
            errorResponse: NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 })
        };
    }
}

const cleanFileName = (fileName: string) => {
    return fileName.replaceAll(" ", "_").replaceAll("/", "-");
};
