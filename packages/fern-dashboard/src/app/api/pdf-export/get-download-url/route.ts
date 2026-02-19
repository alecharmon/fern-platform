import type { PdfExportDownloadResponse } from "@fern-api/fdr-sdk/orpc-client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthZPermissions } from "@/app/services/dal/authz/middleware";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { getOrpcFdrClient } from "@/app/services/fdr/getFdrClient";
import { docsUrlValidator, orgNameValidator } from "../../utils/validators";

const GetPdfExportDownloadUrlRequestSchema = z.object({
    orgName: orgNameValidator,
    docsUrl: docsUrlValidator,
    taskId: z.string().min(1, "taskId is required")
});

export declare namespace getPdfExportDownloadUrl {
    export type Request = z.infer<typeof GetPdfExportDownloadUrlRequestSchema>;

    export type Response = PdfExportDownloadResponse;
}

export const POST = withZodValidation(
    GetPdfExportDownloadUrlRequestSchema,
    withAuthZPermissions(["view"], async (_, body, session) => {
        const client = getOrpcFdrClient({ token: session.token });
        try {
            const response = await client.pdfExport.getDownloadUrl({
                taskId: body.taskId
            });
            return NextResponse.json(response);
        } catch {
            return NextResponse.json({ error: "Failed to get download URL" }, { status: 500 });
        }
    })
);
