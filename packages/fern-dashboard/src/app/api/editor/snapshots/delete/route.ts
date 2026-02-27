import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthZPermissions } from "@/app/services/dal/authz/middleware";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { deleteSnapshot } from "@/app/services/editor-snapshots/repository";
import { docsUrlValidator, orgNameValidator } from "../../../utils/validators";

const DeleteSnapshotRequestSchema = z.object({
    orgName: orgNameValidator,
    branch: z.string().min(1),
    docsUrl: docsUrlValidator
});

export const POST = withZodValidation(
    DeleteSnapshotRequestSchema,
    withAuthZPermissions(["view", "manage-settings"], async (_, body, session) => {
        try {
            const deleted = await deleteSnapshot(body.orgName, body.branch, body.docsUrl);
            return NextResponse.json({ deleted });
        } catch {
            return NextResponse.json({ error: "Failed to delete snapshot" }, { status: 500 });
        }
    })
);
