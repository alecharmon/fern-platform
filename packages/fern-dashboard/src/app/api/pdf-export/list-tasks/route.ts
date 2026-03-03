import type { PdfExportTask } from "@fern-api/fdr-sdk/orpc-client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthZPermissions } from "@/app/services/dal/authz/middleware";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { getOrpcFdrClient } from "@/app/services/fdr/getFdrClient";
import { docsUrlValidator, orgNameValidator } from "../../utils/validators";

const ListPdfExportTasksRequestSchema = z.object({
    orgName: orgNameValidator,
    docsUrl: docsUrlValidator
});

export declare namespace listPdfExportTasks {
    export type Request = z.infer<typeof ListPdfExportTasksRequestSchema>;

    export interface Response {
        tasks: PdfExportTask[];
    }
}

const MAX_TASKS = 20;

export const POST = withZodValidation(
    ListPdfExportTasksRequestSchema,
    withAuthZPermissions(["view"], async (_, body, session) => {
        const client = getOrpcFdrClient({ token: session.token });
        try {
            const response = await client.pdfExport.listTasks({
                orgId: body.orgName,
                docsUrl: body.docsUrl,
                limit: MAX_TASKS
            });
            return NextResponse.json({ tasks: response.tasks });
        } catch {
            return NextResponse.json({ error: "Failed to list PDF export tasks" }, { status: 500 });
        }
    })
);
