import { deleteOidcGroupMapping, listOidcGroupMappings } from "@fern-api/user-permissions";
import { NextResponse } from "next/server";
import { z } from "zod";
import { orgNameValidator } from "@/app/api/utils/validators";
import { withOrgPermissions } from "@/app/services/dal/authz/org-middleware";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { invalidateOrgSessions } from "../_utils/invalidateOrgSessions";

const DeleteOidcGroupMappingSchema = z.object({
    orgName: orgNameValidator,
    mappingId: z.string().uuid()
});

export const POST = withZodValidation(
    DeleteOidcGroupMappingSchema,
    withOrgPermissions(["manage-settings"], async (_req, body, session) => {
        try {
            // Verify the mapping belongs to this org before deleting
            const mappings = await listOidcGroupMappings(session.orgId);
            const mapping = mappings.find((m) => m.id === body.mappingId);
            if (!mapping) {
                return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
            }

            await deleteOidcGroupMapping(body.mappingId);
            await invalidateOrgSessions(body.orgName, { excludeUserId: session.userId });

            return NextResponse.json({ success: true });
        } catch (error) {
            console.error("[oidc-group-mappings/delete] Error:", error);
            return NextResponse.json({ error: "Failed to delete OIDC group mapping" }, { status: 500 });
        }
    })
);
