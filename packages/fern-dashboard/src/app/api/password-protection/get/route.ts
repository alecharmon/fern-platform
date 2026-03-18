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
        passwords: Array<{ password: string; roles: string[] }> | null;
        lastUpdatedAt: string | null;
        lastUpdatedBy: string | null;
    }
}

export const POST = withZodValidation(
    GetPasswordProtectionRequestSchema,
    withAuthZPermissions(["view"], async (_req, body) => {
        try {
            const authMap = await readEdgeConfigItem<Record<string, unknown>>("authentication");
            const emptyResponse = { password: null, passwords: null, lastUpdatedAt: null, lastUpdatedBy: null };

            if (!authMap) {
                console.warn(`[password-protection/get] No auth map found in edge config for ${body.docsUrl}`);
                return NextResponse.json(emptyResponse);
            }

            const entry = authMap[body.docsUrl];
            if (!entry || typeof entry !== "object") {
                console.warn(`[password-protection/get] No entry found for ${body.docsUrl}`);
                return NextResponse.json(emptyResponse);
            }

            const parsed = AuthEdgeConfigSchema.safeParse(entry);
            if (!parsed.success || parsed.data.type !== "password") {
                if (!parsed.success) {
                    console.warn(
                        `[password-protection/get] Failed to parse auth config for ${body.docsUrl}:`,
                        parsed.error.issues
                    );
                } else {
                    console.warn(
                        `[password-protection/get] Auth type is "${parsed.data.type}", not "password" for ${body.docsUrl}`
                    );
                }
                return NextResponse.json(emptyResponse);
            }

            const raw = entry as Record<string, unknown>;
            const lastUpdatedAt = typeof raw.lastUpdatedAt === "string" ? raw.lastUpdatedAt : null;
            const lastUpdatedBy = typeof raw.lastUpdatedBy === "string" ? raw.lastUpdatedBy : null;

            const passwords =
                "passwords" in parsed.data && Array.isArray(parsed.data.passwords) ? parsed.data.passwords : null;

            return NextResponse.json({
                password: parsed.data.password ?? null,
                passwords,
                lastUpdatedAt,
                lastUpdatedBy
            });
        } catch (error) {
            console.error("[password-protection/get] Error:", error);
            return NextResponse.json({ error: "Failed to fetch password configuration" }, { status: 500 });
        }
    })
);
