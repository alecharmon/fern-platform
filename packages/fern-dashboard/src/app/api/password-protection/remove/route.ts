import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthZPermissions } from "@/app/services/dal/authz/middleware";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { patchEdgeConfigItems, readEdgeConfigItem } from "@/app/services/edge-config/vercel-edge-config-api";
import { docsUrlValidator, orgNameValidator } from "../../utils/validators";

const RemovePasswordProtectionRequestSchema = z.object({
    orgName: orgNameValidator,
    docsUrl: docsUrlValidator
});

export declare namespace removePasswordProtection {
    export type Request = z.infer<typeof RemovePasswordProtectionRequestSchema>;

    export interface Response {
        success: boolean;
    }
}

export const POST = withZodValidation(
    RemovePasswordProtectionRequestSchema,
    withAuthZPermissions(["view", "manage-settings"], async (_req, body) => {
        try {
            const currentAuthMap = await readEdgeConfigItem<Record<string, unknown>>("authentication");
            if (!currentAuthMap || !(body.docsUrl in currentAuthMap)) {
                return NextResponse.json({ success: true });
            }

            const { [body.docsUrl]: _, ...updatedAuthMap } = currentAuthMap;

            await patchEdgeConfigItems([
                {
                    operation: "upsert",
                    key: "authentication",
                    value: updatedAuthMap
                }
            ]);

            return NextResponse.json({ success: true });
        } catch (error) {
            console.error("[password-protection/remove] Error:", error);
            return NextResponse.json({ error: "Failed to remove password protection" }, { status: 500 });
        }
    })
);
