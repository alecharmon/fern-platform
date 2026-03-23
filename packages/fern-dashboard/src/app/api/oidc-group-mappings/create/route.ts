import { createOidcGroupMapping } from "@fern-api/user-permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

import { withOrgPermissions } from "@/app/services/dal/authz/org-middleware";
import { withZodValidation } from "@/app/services/dal/zod/middleware";
import { orgNameValidator } from "@/app/api/utils/validators";
import { invalidateOrgSessions } from "../_utils/invalidateOrgSessions";

const CreateOidcGroupMappingSchema = z
    .object({
        orgName: orgNameValidator,
        connectionName: z.string().min(1),
        groupId: z.string().min(1),
        mappingType: z.enum(["org_role", "resource_role"]),
        role: z.enum(["admin", "editor", "viewer"]),
        resourceType: z.string().optional(),
        resourceId: z.string().optional()
    })
    .refine(
        (data) => {
            if (data.mappingType === "resource_role") {
                return data.resourceType != null && data.resourceId != null;
            }
            return data.resourceType == null && data.resourceId == null;
        },
        {
            message:
                "resource_role mappings require resourceType and resourceId; org_role mappings must not include them"
        }
    );

export const POST = withZodValidation(
    CreateOidcGroupMappingSchema,
    withOrgPermissions(["manage-settings"], async (_req, body, session) => {
        try {
            const mapping = await createOidcGroupMapping({
                orgId: session.orgId,
                connectionName: body.connectionName,
                groupId: body.groupId,
                mappingType: body.mappingType,
                role: body.role,
                resourceType: body.resourceType,
                resourceId: body.resourceId,
                createdBy: session.userId
            });

            await invalidateOrgSessions(body.orgName);

            return NextResponse.json({ mapping });
        } catch (error) {
            console.error("[oidc-group-mappings/create] Error:", error);
            const message = error instanceof Error ? error.message : "Failed to create OIDC group mapping";
            if (message.includes("duplicate") || message.includes("unique")) {
                return NextResponse.json({ error: "A mapping with these parameters already exists" }, { status: 409 });
            }
            return NextResponse.json({ error: "Failed to create OIDC group mapping" }, { status: 500 });
        }
    })
);
