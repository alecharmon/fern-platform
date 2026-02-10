import { FdrAPI } from "@fern-api/fdr-sdk/client/types";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthZPermissions } from "@/app/services/dal/authz/middleware";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { getFdrClient } from "@/app/services/fdr/getFdrClient";
import { docsUrlValidator, orgNameValidator } from "../../utils/validators";

const ListPdfExportTasksRequestSchema = z.object({
    orgName: orgNameValidator,
    docsUrl: docsUrlValidator,
    limit: z.number().int().positive().max(50).optional()
});

export declare namespace listPdfExportTasks {
    export type Request = z.infer<typeof ListPdfExportTasksRequestSchema>;

    export interface Response {
        tasks: FdrAPI.pdfExport.PdfExportTask[];
    }
}

export const POST = withZodValidation(
    ListPdfExportTasksRequestSchema,
    withAuthZPermissions(["view"], async (_, body, session) => {
        const fdr = getFdrClient({ token: session.token });
        const resp = await fdr.pdfExport.listTasks({
            orgId: FdrAPI.OrgId(body.orgName),
            docsUrl: body.docsUrl,
            limit: body.limit
        });

        if (!resp.ok) {
            return NextResponse.json({ error: "Failed to list PDF export tasks" }, { status: 500 });
        }

        return NextResponse.json({ tasks: resp.body.tasks });
    })
);
