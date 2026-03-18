import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthZPermissions } from "@/app/services/dal/authz/middleware";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { patchEdgeConfigItems, readEdgeConfigItem } from "@/app/services/edge-config/vercel-edge-config-api";
import { invalidateAndRevalidateDocsCache } from "../../utils/invalidate-docs-cache";
import { docsUrlValidator, orgNameValidator } from "../../utils/validators";

const PasswordWithRolesSchema = z.object({
    password: z.string().min(1).max(64),
    roles: z.array(z.string().min(1)).min(1)
});

const SetPasswordProtectionRequestSchema = z.object({
    orgName: orgNameValidator,
    docsUrl: docsUrlValidator,
    password: z
        .string()
        .min(1, "Password cannot be empty")
        .max(64, "Password cannot be longer than 64 characters")
        .optional(),
    passwords: z.array(PasswordWithRolesSchema).optional()
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

            const authEntry: Record<string, unknown> = {
                type: "password" as const,
                lastUpdatedAt,
                lastUpdatedBy
            };

            if (body.passwords && body.passwords.length > 0) {
                // Role-based passwords: store passwords array, omit standalone password
                authEntry.passwords = body.passwords;
            } else if (body.password) {
                // Standalone password: store password, omit passwords array
                authEntry.password = body.password;
            }

            const updatedAuthMap = {
                ...currentAuthMap,
                [body.docsUrl]: authEntry
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
