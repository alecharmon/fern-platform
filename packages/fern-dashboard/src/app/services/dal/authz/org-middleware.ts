import { type AuthZPermission, getPermissionsFromSession, hasPermission } from "@fern-api/user-permissions";
import { type NextRequest, NextResponse } from "next/server";

import { type ApiSessionData, maybeGetCurrentSession } from "@/app/api/utils/maybeGetCurrentSession";
import { getOrgIdFromName } from "@/app/services/auth0/management";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";

/**
 * Higher-order handler for org-level authorization (no docsUrl required).
 *
 * Compose with `withZodValidation`:
 *
 * ```ts
 * export const POST = withZodValidation(
 *     MySchema,
 *     withOrgPermissions(["manage-settings"], async (req, body, session) => {
 *         return NextResponse.json({ ok: true });
 *     })
 * );
 * ```
 *
 * Flow:
 * 1. Validate session
 * 2. Resolve orgId from orgName
 * 3. Validate org membership
 * 4. Check org-level permissions
 */
export function withOrgPermissions<TBody extends { orgName: Auth0OrgName }>(
    requiredPermOrPerms: AuthZPermission | AuthZPermission[],
    handler: (req: NextRequest, body: TBody, session: ApiSessionData & { orgId: string }) => Promise<NextResponse>
) {
    const requiredPerms = Array.isArray(requiredPermOrPerms) ? requiredPermOrPerms : [requiredPermOrPerms];

    return async (req: NextRequest, body: TBody): Promise<NextResponse> => {
        const { orgName } = body;

        // 1) Validate session
        const sessionResult = await maybeGetCurrentSession(req);
        if (sessionResult.errorResponse != null) {
            return sessionResult.errorResponse;
        }
        const { token, permissions: sessionPerms } = sessionResult.data;

        // 2) Resolve orgId
        let orgId: string;
        try {
            orgId = await getOrgIdFromName(orgName);
        } catch (error) {
            console.error("[withOrgPermissions] Failed to resolve orgId", error);
            return NextResponse.json({ error: "Failed to fetch requested organization." }, { status: 404 });
        }

        // 3) Validate org membership
        try {
            await assertUserHasOrganizationAccess(token, orgName);
        } catch {
            return NextResponse.json({ error: "User is not a member of the specified organization." }, { status: 403 });
        }

        // 4) Check AuthZ permissions
        const sessionAuthZPerms = getPermissionsFromSession({ sessionPermissions: sessionPerms });
        for (const requiredPerm of requiredPerms) {
            if (!hasPermission(sessionAuthZPerms, requiredPerm)) {
                return NextResponse.json(
                    { error: "User does not have required permissions to perform this request." },
                    { status: 403 }
                );
            }
        }

        return await handler(req, body, { ...sessionResult.data, orgId });
    };
}
