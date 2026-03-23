import { listOidcGroupMappings } from "@fern-api/user-permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

import { withOrgPermissions } from "@/app/services/dal/authz/org-middleware";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { orgNameValidator } from "@/app/api/utils/validators";

const ListOidcGroupMappingsSchema = z.object({
    orgName: orgNameValidator,
    connectionName: z.string().optional()
});

export const POST = withZodValidation(
    ListOidcGroupMappingsSchema,
    withOrgPermissions(["manage-settings"], async (_req, body, session) => {
        try {
            let mappings = await listOidcGroupMappings(session.orgId);

            if (body.connectionName) {
                mappings = mappings.filter((m) => m.connectionName === body.connectionName);
            }

            return NextResponse.json({ mappings });
        } catch (error) {
            console.error("[oidc-group-mappings/list] Error:", error);
            return NextResponse.json({ error: "Failed to list OIDC group mappings" }, { status: 500 });
        }
    })
);
