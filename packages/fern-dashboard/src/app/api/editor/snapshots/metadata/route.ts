import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthZPermissions } from "@/app/services/dal/authz/middleware";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { updateSnapshotMetadata } from "@/app/services/editor-snapshots/repository";
import { docsUrlValidator, orgNameValidator } from "../../../utils/validators";

const UpdateMetadataRequestSchema = z.object({
    orgName: orgNameValidator,
    branch: z.string().min(1),
    docsUrl: docsUrlValidator,
    prTitle: z.string().nullish(),
    prUrl: z.string().nullish()
});

export const POST = withZodValidation(
    UpdateMetadataRequestSchema,
    withAuthZPermissions(["view", "manage-settings"], async (_, body, session) => {
        try {
            const success = await updateSnapshotMetadata(body.orgName, body.branch, body.docsUrl, {
                prTitle: body.prTitle,
                prUrl: body.prUrl
            });
            return NextResponse.json({ success });
        } catch {
            return NextResponse.json({ error: "Failed to update metadata" }, { status: 500 });
        }
    })
);
