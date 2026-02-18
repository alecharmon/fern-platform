import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthZPermissions } from "@/app/services/dal/authz/middleware";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { getFdrBaseUrl } from "@/app/services/fdr/getFdrClient";
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
        const baseUrl = getFdrBaseUrl();
        const resp = await fetch(`${baseUrl}/pdf-export/task/${encodeURIComponent(body.taskId)}/download-url`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${session.token}`
            }
        });

        if (!resp.ok) {
            return NextResponse.json({ error: "Failed to get download URL" }, { status: 500 });
        }

        const data = await resp.json();
        return NextResponse.json(data);
    })
);
