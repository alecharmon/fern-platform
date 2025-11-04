import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { withZodValidation } from "@/app/services/dal/zod/middleware";

import handler, { type OnboardingDocsRequest } from "./handler";

export declare namespace createOnboardingDocs {
    export type Request = z.infer<typeof CreateOnboardingDocsRequest>;
    export type Response = z.infer<typeof CreateOnboardingDocsResponse>;
}

const CreateOnboardingDocsRequest = z.object({
    orgName: z.string().min(1),
    docsSiteName: z.string().min(1),
    docsSiteUrl: z.string().min(1),
    docsSiteUrlAvailable: z.boolean().nullable(),
    faviconUrl: z.string().url().nullable(),
    logoUrl: z.string().url().nullable(),
    primaryColorHex: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .nullable(),
    existingDocsSite: z.string(),
    openApiSpecUrls: z.array(
        z.object({
            fileName: z.string(),
            assetUrl: z.string().url()
        })
    )
});

const CreateOnboardingDocsResponse = z.object({
    url: z.string(),
    message: z.string(),
    cliOutput: z.string(),
    fernDocsDownloadUrl: z.string()
});

export const POST = withZodValidation(
    CreateOnboardingDocsRequest,
    async (req: NextRequest, validatedBody: z.infer<typeof CreateOnboardingDocsRequest>) => {
        const session = await getCurrentSession();

        // Use the session's access token as FERN_TOKEN if available
        const fernToken = session?.accessToken;

        const result = await handler(validatedBody as OnboardingDocsRequest, fernToken);

        if (result.errorResponse != null) {
            return result.errorResponse;
        }

        const validatedResult = CreateOnboardingDocsResponse.parse(result.data);
        return NextResponse.json(validatedResult);
    }
);
