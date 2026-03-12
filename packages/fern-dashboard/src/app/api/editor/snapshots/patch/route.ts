import type { Json } from "@fern-platform/supabase";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthZPermissions } from "@/app/services/dal/authz/middleware";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { patchSnapshot } from "@/app/services/editor-snapshots/repository";
import { docsUrlValidator, orgNameValidator } from "../../../utils/validators";

const PatchSnapshotRequestSchema = z.object({
    orgName: orgNameValidator,
    branch: z.string().min(1),
    docsUrl: docsUrlValidator,
    patch: z.record(z.unknown()),
    schemaVersion: z.number().nullish()
});

export const POST = withZodValidation(
    PatchSnapshotRequestSchema,
    withAuthZPermissions(["view", "manage-settings"], async (_, body, session) => {
        try {
            const result = await patchSnapshot({
                userId: session.userId,
                orgId: body.orgName,
                branch: body.branch,
                docsUrl: body.docsUrl,
                patch: body.patch as Record<string, Json>,
                schemaVersion: body.schemaVersion ?? 1
            });

            return NextResponse.json(result);
        } catch {
            return NextResponse.json({ error: "Failed to patch snapshot" }, { status: 500 });
        }
    })
);
