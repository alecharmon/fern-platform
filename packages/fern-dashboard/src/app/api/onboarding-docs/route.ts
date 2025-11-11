import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { withZodValidation } from "@/app/services/dal/zod/middleware";

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
    ),
    sessionId: z.string()
});

// This endpoint now only handles the streaming case
// The actual work is done by /api/onboarding-docs/stream
export const POST = withZodValidation(
    CreateOnboardingDocsRequest,
    async (_req: NextRequest, validatedBody: z.infer<typeof CreateOnboardingDocsRequest>) => {
        return NextResponse.json({
            streaming: true,
            sessionId: validatedBody.sessionId,
            message: "Documentation generation started. Check the stream for progress."
        });
    }
);
