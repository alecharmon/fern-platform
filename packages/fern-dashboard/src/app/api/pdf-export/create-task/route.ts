import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthZPermissions } from "@/app/services/dal/authz/middleware";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { getFdrBaseUrl } from "@/app/services/fdr/getFdrClient";
import type { ExportTask } from "@/components/pdf-exporter/types";
import { docsUrlValidator, orgNameValidator } from "../../utils/validators";

const CreatePdfExportTaskRequestSchema = z.object({
    orgName: orgNameValidator,
    docsUrl: docsUrlValidator,
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
        task: ExportTask;
    }
}

export const POST = withZodValidation(
    CreatePdfExportTaskRequestSchema,
    withAuthZPermissions(["view", "manage-settings"], async (_req, body, session) => {
        const baseUrl = getFdrBaseUrl();
        const resp = await fetch(`${baseUrl}/pdf-export/task`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.token}`
            },
            body: JSON.stringify({
                orgId: body.orgName,
                docsUrl: body.docsUrl,
                requesterName: session.name,
                notifyEmails: session.email != null ? [session.email] : undefined,
                options: {
                    version: "v1",
                    coverTitle: body.options?.coverTitle,
                    coverSubtitle: body.options?.coverSubtitle,
                    hideCoverFooter: body.options?.hideCoverFooter,
                    headerLeftTemplate: body.options?.headerLeftTemplate,
                    headerRightTemplate: body.options?.headerRightTemplate,
                    footerLeftTemplate: body.options?.footerLeftTemplate,
                    footerRightTemplate: body.options?.footerRightTemplate
                }
            })
        });

        if (!resp.ok) {
            return NextResponse.json({ error: "Failed to create PDF export task" }, { status: 500 });
        }

        const task = await resp.json();
        return NextResponse.json({ task });
    })
);
