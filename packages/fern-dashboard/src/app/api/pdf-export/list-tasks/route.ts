import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthZPermissions } from "@/app/services/dal/authz/middleware";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { getFdrBaseUrl } from "@/app/services/fdr/getFdrClient";
import type { ExportTask } from "@/components/pdf-exporter/types";
import { docsUrlValidator, orgNameValidator } from "../../utils/validators";

const ListPdfExportTasksRequestSchema = z.object({
    orgName: orgNameValidator,
    docsUrl: docsUrlValidator,
    limit: z.number().int().positive().max(50).optional()
});

export declare namespace listPdfExportTasks {
    export type Request = z.infer<typeof ListPdfExportTasksRequestSchema>;

    export interface Response {
        tasks: ExportTask[];
    }
}

export const POST = withZodValidation(
    ListPdfExportTasksRequestSchema,
    withAuthZPermissions(["view"], async (_, body, session) => {
        const baseUrl = getFdrBaseUrl();
        const params = new URLSearchParams({
            orgId: body.orgName,
            docsUrl: body.docsUrl
        });
        if (body.limit != null) {
            params.set("limit", String(body.limit));
        }
        const resp = await fetch(`${baseUrl}/pdf-export/tasks?${params.toString()}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${session.token}`
            }
        });

        if (!resp.ok) {
            return NextResponse.json({ error: "Failed to list PDF export tasks" }, { status: 500 });
        }

        const data = await resp.json();
        return NextResponse.json({ tasks: data.tasks });
    })
);
