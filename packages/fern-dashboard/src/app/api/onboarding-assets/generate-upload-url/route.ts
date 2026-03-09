import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
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
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { organizationId, contentType, docsSite, fileName, fileHash } = validatedBody;

        // Verify the authenticated user belongs to the requested organization
        try {
            await assertUserHasOrganizationAccess(maybeSessionData.data.token, organizationId as Auth0OrgName);
        } catch (error) {
            const digest =
                error instanceof Error && "digest" in error ? (error as { digest: string }).digest : undefined;
            if (digest === "ORG_NOT_FOUND" || digest === "USER_NOT_IN_ORG") {
                return NextResponse.json({ error: "Forbidden: organization mismatch" }, { status: 403 });
            }
            // Venus API or unexpected error — return 500 so the client can retry
            console.error("[generate-upload-url] Organization access check failed unexpectedly", error);
            return NextResponse.json({ error: "Internal server error" }, { status: 500 });
        }

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
