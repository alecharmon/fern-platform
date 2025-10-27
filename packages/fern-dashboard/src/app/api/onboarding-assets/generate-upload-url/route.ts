import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { withZodValidation } from "@/app/services/dal/zod/middleware";

import { maybeGetCurrentSession } from "../../utils/maybeGetCurrentSession";
import handler from "./handler";

export declare namespace generateOnboardingAssetUploadUrl {
    export type Request = z.infer<typeof GenerateOnboardingAssetUploadUrlRequest>;
    export type Response = z.infer<typeof GenerateOnboardingAssetUploadUrlResponse>;
}

const GenerateOnboardingAssetUploadUrlRequest = z.object({
    organizationId: z.string(),
    contentType: z.string(),
    docsSite: z.string().optional(),
    fileName: z.string().optional(),
    fileHash: z.string().optional()
});

const GenerateOnboardingAssetUploadUrlResponse = z.object({
    uploadUrl: z.string(),
    assetUrl: z.string(),
    key: z.string()
});

export const POST = withZodValidation(
    GenerateOnboardingAssetUploadUrlRequest,
    async (req: NextRequest, validatedBody: z.infer<typeof GenerateOnboardingAssetUploadUrlRequest>) => {
        const maybeSessionData = await maybeGetCurrentSession(req);
        if (maybeSessionData.errorResponse != null) {
            return maybeSessionData.errorResponse;
        }

        const { organizationId, contentType, docsSite, fileName, fileHash } = validatedBody;

        const result = await handler({
            organizationId,
            contentType,
            docsSite,
            fileName,
            fileHash
        });

        if (result.errorResponse != null) {
            return result.errorResponse;
        }

        const validatedResult = GenerateOnboardingAssetUploadUrlResponse.parse(result.data);
        return NextResponse.json(validatedResult);
    }
);
