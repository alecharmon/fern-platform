import { AuthEdgeConfigSchema } from "@fern-api/docs-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthZPermissions } from "@/app/services/dal/authz/middleware";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { readEdgeConfigItem } from "@/app/services/edge-config/vercel-edge-config-api";
import { docsUrlValidator, orgNameValidator } from "../../utils/validators";

const GetPasswordProtectionRequestSchema = z.object({
    orgName: orgNameValidator,
    docsUrl: docsUrlValidator
});

export declare namespace getPasswordProtection {
    export type Request = z.infer<typeof GetPasswordProtectionRequestSchema>;

    export interface Response {
        password: string | null;
        lastUpdatedAt: string | null;
        lastUpdatedBy: string | null;
    }
}

export const POST = withZodValidation(
    GetPasswordProtectionRequestSchema,
    withAuthZPermissions(["view"], async (_req, body) => {
        try {
            const authMap = await readEdgeConfigItem<Record<string, unknown>>("authentication");
            if (!authMap) {
                return NextResponse.json({ password: null, lastUpdatedAt: null, lastUpdatedBy: null });
            }

            const entry = authMap[body.docsUrl];
            if (!entry || typeof entry !== "object") {
                return NextResponse.json({ password: null, lastUpdatedAt: null, lastUpdatedBy: null });
            }

            const parsed = AuthEdgeConfigSchema.safeParse(entry);
            if (!parsed.success || parsed.data.type !== "password") {
                return NextResponse.json({ password: null, lastUpdatedAt: null, lastUpdatedBy: null });
            }

            const raw = entry as Record<string, unknown>;
            const lastUpdatedAt = typeof raw.lastUpdatedAt === "string" ? raw.lastUpdatedAt : null;
            const lastUpdatedBy = typeof raw.lastUpdatedBy === "string" ? raw.lastUpdatedBy : null;

            return NextResponse.json({ password: parsed.data.password, lastUpdatedAt, lastUpdatedBy });
        } catch (error) {
            console.error("[password-protection/get] Error:", error);
            return NextResponse.json({ error: "Failed to fetch password configuration" }, { status: 500 });
        }
    })
);
