import type { PdfExportTask } from "@fern-api/fdr-sdk/orpc-client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthZPermissions } from "@/app/services/dal/authz/middleware";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { getOrpcFdrClient } from "@/app/services/fdr/getFdrClient";
import { docsUrlValidator, orgNameValidator } from "../../utils/validators";

const CreatePdfExportTaskRequestSchema = z.object({
    orgName: orgNameValidator,
    docsUrl: docsUrlValidator,
    productId: z.string().min(1).optional(),
    versionId: z.string().min(1).optional(),
    options: z
        .object({
            coverTitle: z.string(),
            coverSubtitle: z.string(),
            hideCoverFooter: z.boolean(),
            headerLeftTemplate: z.string(),
            headerRightTemplate: z.string(),
            footerLeftTemplate: z.string(),
            footerRightTemplate: z.string()
        })
        .partial()
});

export declare namespace createPdfExportTask {
    export type Request = z.infer<typeof CreatePdfExportTaskRequestSchema>;

    export interface Response {
        task: PdfExportTask;
    }
}

export const POST = withZodValidation(
    CreatePdfExportTaskRequestSchema,
    withAuthZPermissions(["view", "manage-settings"], async (_req, body, session) => {
        const client = getOrpcFdrClient({ token: session.token });
        try {
            const task = await client.pdfExport.createTask({
                orgId: body.orgName,
                docsUrl: body.docsUrl,
                productId: body.productId,
                versionId: body.versionId,
                requesterName: session.name,
                options:
                    body.options != null
                        ? {
                              version: "v1" as const,
                              coverTitle: body.options.coverTitle,
                              coverSubtitle: body.options.coverSubtitle,
                              hideCoverFooter: body.options.hideCoverFooter,
                              headerLeftTemplate: body.options.headerLeftTemplate,
                              headerRightTemplate: body.options.headerRightTemplate,
                              footerLeftTemplate: body.options.footerLeftTemplate,
                              footerRightTemplate: body.options.footerRightTemplate
                          }
                        : undefined
            });
            return NextResponse.json({ task });
        } catch {
            return NextResponse.json({ error: "Failed to create PDF export task" }, { status: 500 });
        }
    })
);
