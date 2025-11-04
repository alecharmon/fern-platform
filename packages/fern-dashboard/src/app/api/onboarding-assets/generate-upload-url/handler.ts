import "server-only";

import { NextResponse } from "next/server";

import { OnboardS3Service } from "@/app/services/onboarding-assets";

import type { MaybeErrorResponse } from "../../utils/MaybeErrorResponse";

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
        const result = await OnboardS3Service.generateUploadUrl({
            organizationId,
            contentType,
            docsSite,
            fileName,
            fileHash
        });

        return {
            data: result
        };
    } catch (error) {
        console.error("Error creating pre-signed URL for onboarding asset:", error);
        return {
            errorResponse: NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 })
        };
    }
}
