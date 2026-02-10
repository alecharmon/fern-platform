import { FdrAPI } from "@fern-api/fdr-sdk/client/types";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthZPermissions } from "@/app/services/dal/authz/middleware";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { getFdrClient } from "@/app/services/fdr/getFdrClient";
import { docsUrlValidator, orgNameValidator } from "../../utils/validators";

const GetPdfExportDownloadUrlRequestSchema = z.object({
    orgName: orgNameValidator,
    docsUrl: docsUrlValidator,
    taskId: z.string().min(1, "taskId is required")
});

export declare namespace getPdfExportDownloadUrl {
    export type Request = z.infer<typeof GetPdfExportDownloadUrlRequestSchema>;

    export interface Response {
        downloadUrl: string;
        fileName: string;
        sizeBytes: number;
    }
}

export const POST = withZodValidation(
    GetPdfExportDownloadUrlRequestSchema,
    withAuthZPermissions(["view"], async (_, body, session) => {
        const fdr = getFdrClient({ token: session.token });
        const resp = await fdr.pdfExport.getDownloadUrl(FdrAPI.pdfExport.PdfExportTaskId(body.taskId));

        if (!resp.ok) {
            return NextResponse.json({ error: "Failed to get download URL" }, { status: 500 });
        }

        return NextResponse.json(resp.body);
    })
);
