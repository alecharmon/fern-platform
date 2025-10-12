import "server-only";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

import { getS3Client } from "@/app/services/s3";

import type { MaybeErrorResponse } from "../../utils/MaybeErrorResponse";
import { getSignedImageUrlBucketName } from "../bucket";

export default async function generateSignedUploadUrlHandler({
    fileName,
    docsUrl,
    slug,
    contentType
}: {
    fileName: string;
    contentType: string;
    docsUrl: string;
    slug: string;
}): Promise<
    MaybeErrorResponse<{
        uploadUrl: string;
        imageUrl: string;
        key: string;
    }>
> {
    try {
        // Generate a unique key for the uploaded image
        const timestamp = new Date().toISOString();
        // const randomId = Math.random().toString(36).substring(2, 15);
        const key = `visual-editor-images/${docsUrl}/${timestamp}/${slug}/${cleanFileName(fileName)}`;

        // Create a pre-signed URL for uploading to S3
        const s3Client = getS3Client();
        const command = new PutObjectCommand({
            Bucket: getSignedImageUrlBucketName(),
            Key: key,
            ContentType: contentType
        });

        const uploadUrl = await getSignedUrl(s3Client, command, {
            expiresIn: 60 * 10
        }); // 10 minutes expiry

        // The final image URL that will be accessible after upload
        const imageUrl = `https://files.buildwithfern.com/${key}`;

        return {
            data: {
                uploadUrl,
                imageUrl,
                key
            }
        };
    } catch (error) {
        console.error("Error creating pre-signed URL:", error);
        return {
            errorResponse: NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 })
        };
    }
}

const cleanFileName = (fileName: string) => {
    return fileName.replaceAll(" ", "_").replaceAll("/", "-");
};
