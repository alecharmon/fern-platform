import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthZPermissions } from "@/app/services/dal/authz/middleware";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { getSnapshot } from "@/app/services/editor-snapshots/repository";
import { docsUrlValidator, orgNameValidator } from "../../../utils/validators";

const GetSnapshotRequestSchema = z.object({
    orgName: orgNameValidator,
    branch: z.string().min(1),
    docsUrl: docsUrlValidator,
    localSnapshot: z.unknown().nullish()
});

export const POST = withZodValidation(
    GetSnapshotRequestSchema,
    withAuthZPermissions(["view"], async (_, body, session) => {
        try {
            const snapshot = await getSnapshot(body.orgName, body.branch, body.docsUrl);
            if (snapshot != null) {
                return NextResponse.json({ source: "remote", snapshot: snapshot.snapshotData });
            }
        } catch (e) {
            console.error("[editor/snapshots/get] Failed to load remote snapshot:", e);
        }

        if (body.localSnapshot != null) {
            return NextResponse.json({ source: "local", snapshot: body.localSnapshot });
        }

        return NextResponse.json({ source: "remote", snapshot: null });
    })
);
