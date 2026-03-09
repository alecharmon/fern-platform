import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import { withZodValidation } from "@/app/services/dal/zod/middleware";

import { maybeGetCurrentSession } from "../../utils/maybeGetCurrentSession";
import handler from "./handler";

const FernDocsDownloadRequest = z.object({
    docsUrl: z.string().min(1)
});

const FernDocsDownloadResponse = z.object({
    exists: z.boolean(),
    downloadUrl: z.string().optional()
});

export const POST = withZodValidation(
    FernDocsDownloadRequest,
    async (req: NextRequest, validatedBody: z.infer<typeof FernDocsDownloadRequest>) => {
        const maybeSessionData = await maybeGetCurrentSession(req);
        if (maybeSessionData.errorResponse != null) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const result = await handler(validatedBody);

        if (result.errorResponse != null) {
            return result.errorResponse;
        }

        const validatedResult = FernDocsDownloadResponse.parse(result.data);
        return NextResponse.json(validatedResult);
    }
);
