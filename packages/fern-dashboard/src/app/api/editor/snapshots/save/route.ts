import type { Json } from "@fern-platform/supabase";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthZPermissions } from "@/app/services/dal/authz/middleware";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { upsertSnapshot } from "@/app/services/editor-snapshots/repository";
import { captureServerEvent, PosthogEventName } from "@/components/posthog/events";
import { getServerSidePosthog } from "@/components/posthog/getServerSidePosthog";
import { docsUrlValidator, orgNameValidator } from "../../../utils/validators";

const SaveSnapshotRequestSchema = z.object({
    orgName: orgNameValidator,
    branch: z.string().min(1),
    docsUrl: docsUrlValidator,
    snapshotData: z.unknown(),
    schemaVersion: z.number().nullish()
});

export const POST = withZodValidation(
    SaveSnapshotRequestSchema,
    withAuthZPermissions(["view", "manage-settings"], async (_, body, session) => {
        try {
            const result = await upsertSnapshot({
                userId: session.userId,
                orgId: body.orgName,
                branch: body.branch,
                docsUrl: body.docsUrl,
                snapshotData: body.snapshotData as Json,
                schemaVersion: body.schemaVersion ?? 1
            });

            try {
                const posthog = getServerSidePosthog();
                captureServerEvent(posthog, session.userId, PosthogEventName.EDITOR_SESSION_STARTED, {
                    orgId: body.orgName,
                    userId: session.userId,
                    docsUrl: body.docsUrl
                });
            } catch {
                // non-critical analytics
            }

            return NextResponse.json(result);
        } catch {
            return NextResponse.json({ error: "Failed to save snapshot" }, { status: 500 });
        }
    })
);
