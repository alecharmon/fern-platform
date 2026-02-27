import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthZPermissions } from "@/app/services/dal/authz/middleware";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { listSnapshots } from "@/app/services/editor-snapshots/repository";
import { docsUrlValidator, orgNameValidator } from "../../../utils/validators";

const ListSnapshotsRequestSchema = z.object({
    orgName: orgNameValidator,
    docsUrl: docsUrlValidator
});

export const POST = withZodValidation(
    ListSnapshotsRequestSchema,
    withAuthZPermissions(["view"], async (_, body, session) => {
        try {
            const snapshots = await listSnapshots(body.orgName, body.docsUrl);
            return NextResponse.json({ snapshots });
        } catch {
            return NextResponse.json({ error: "Failed to list snapshots" }, { status: 500 });
        }
    })
);
