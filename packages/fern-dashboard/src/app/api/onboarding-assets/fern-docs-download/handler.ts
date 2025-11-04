import "server-only";

import { NextResponse } from "next/server";

import { OnboardS3Service } from "@/app/services/onboarding-assets";

import type { MaybeErrorResponse } from "../../utils/MaybeErrorResponse";

export default async function fernDocsDownloadHandler({ docsUrl }: { docsUrl: string }): Promise<
    MaybeErrorResponse<{
        exists: boolean;
        downloadUrl?: string;
    }>
> {
    try {
        // Generate the S3 key for this docs site
        const s3Key = `fern_docs_${docsUrl}.zip`;

        // Check if the zip exists in S3
        const exists = await OnboardS3Service.checkIfExists({ key: s3Key });

        if (!exists) {
            return {
                data: {
                    exists: false
                }
            };
        }

        // Generate a fresh signed URL for downloading
        const downloadUrl = await OnboardS3Service.generateDownloadUrl({
            key: s3Key,
            expiresIn: 60 * 5 // 5 minutes expiry for the download
        });

        return {
            data: {
                exists: true,
                downloadUrl
            }
        };
    } catch (error) {
        console.error("Error checking/generating fern docs download URL:", error);
        return {
            errorResponse: NextResponse.json({ error: "Failed to generate download URL" }, { status: 500 })
        };
    }
}
