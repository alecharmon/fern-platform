import { FdrAPI } from "@fern-api/fdr-sdk/client/types";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthZPermissions } from "@/app/services/dal/authz/middleware";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { getFdrClient } from "@/app/services/fdr/getFdrClient";
import { docsUrlValidator, orgNameValidator } from "../../utils/validators";

const CreatePdfExportTaskRequestSchema = z.object({
    orgName: orgNameValidator,
    docsUrl: docsUrlValidator,
    options: z
        .object({
            coverTitle: z.string().nullable(),
            coverSubtitle: z.string().nullable(),
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
        task: FdrAPI.pdfExport.PdfExportTask;
    }
}

export const POST = withZodValidation(
    CreatePdfExportTaskRequestSchema,
    withAuthZPermissions(["view", "manage-settings"], async (_req, body, session) => {
        const fdr = getFdrClient({ token: session.token });
        const resp = await fdr.pdfExport.createTask({
            orgId: FdrAPI.OrgId(body.orgName),
            docsUrl: body.docsUrl,
            options: {
                version: "v1",
                coverTitle:
                    body.options?.coverTitle === null || body.options?.coverTitle === ""
                        ? ""
                        : body.options?.coverTitle,
                coverSubtitle:
                    body.options?.coverSubtitle === null || body.options?.coverSubtitle === ""
                        ? ""
                        : body.options?.coverSubtitle,
                hideCoverFooter: body.options?.hideCoverFooter,
                headerLeftTemplate: body.options?.headerLeftTemplate,
                headerRightTemplate: body.options?.headerRightTemplate,
                footerLeftTemplate: body.options?.footerLeftTemplate,
                footerRightTemplate: body.options?.footerRightTemplate
            }
        });

        if (!resp.ok) {
            return NextResponse.json({ error: "Failed to create PDF export task" }, { status: 500 });
        }

        return NextResponse.json({ task: resp.body });
    })
);
