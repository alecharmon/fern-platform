import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthZPermissions } from "@/app/services/dal/authz/middleware";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { patchEdgeConfigItems, readEdgeConfigItem } from "@/app/services/edge-config/vercel-edge-config-api";
import { invalidateAndRevalidateDocsCache } from "../../utils/invalidate-docs-cache";
import { docsUrlValidator, orgNameValidator } from "../../utils/validators";

const SetPasswordProtectionRequestSchema = z.object({
    orgName: orgNameValidator,
    docsUrl: docsUrlValidator,
    password: z.string().min(1, "Password cannot be empty").max(64, "Password cannot be longer than 64 characters")
});

export declare namespace setPasswordProtection {
    export type Request = z.infer<typeof SetPasswordProtectionRequestSchema>;

    export interface Response {
        success: boolean;
        lastUpdatedAt: string;
        lastUpdatedBy: string | null;
    }
}

export const POST = withZodValidation(
    SetPasswordProtectionRequestSchema,
    withAuthZPermissions(["view", "manage-settings"], async (_req, body, session) => {
        try {
            const currentAuthMap = (await readEdgeConfigItem<Record<string, unknown>>("authentication")) ?? {};

            const lastUpdatedAt = new Date().toISOString();
            const lastUpdatedBy = session.name ?? session.email ?? null;

            const updatedAuthMap = {
                ...currentAuthMap,
                [body.docsUrl]: {
                    type: "password" as const,
                    password: body.password,
                    lastUpdatedAt,
                    lastUpdatedBy
                }
            };

            await patchEdgeConfigItems([
                {
                    operation: "upsert",
                    key: "authentication",
                    value: updatedAuthMap
                }
            ]);

            await invalidateAndRevalidateDocsCache(body.docsUrl);

            return NextResponse.json({ success: true, lastUpdatedAt, lastUpdatedBy });
        } catch (error) {
            console.error("[password-protection/set] Error:", error);
            return NextResponse.json({ error: "Failed to set password protection" }, { status: 500 });
        }
    })
);
