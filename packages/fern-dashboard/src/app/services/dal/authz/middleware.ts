import {
    type AuthZPermission,
    getPermissionsFromSession,
    hasPermission,
    hasResourcePermission
} from "@fern-api/user-permissions";
import { type NextRequest, NextResponse } from "next/server";

import { type ApiSessionData, maybeGetCurrentSession } from "@/app/api/utils/maybeGetCurrentSession";
import { getOrgIdFromName } from "@/app/services/auth0/management";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import type { DocsUrl } from "@/utils/types";

/**
 * Higher-order handler that authenticates the user and authorizes access to
 * a docs-scoped resource.
 *
 * Compose with `withZodValidation`:
 *
 * ```ts
 * export const POST = withZodValidation(
 *     MySchema,
 *     withAuthZPermissions(["manage-settings"], async (req, body, session) => {
 *         const fdr = getFdrClient({ token: session.token });
 *         return NextResponse.json({ ok: true });
 *     })
 * );
 * ```
 *
 * Flow:
 * 1. Validate session
 * 2. Check org-level permissions (early reject from session)
 * 3. Validate org membership
 * 4. Check user has "view" access to the docsUrl (resource-scoped authz)
 *
 * The validated session is passed to the handler as the third argument.
 */
export function withAuthZPermissions<TBody extends { orgName: Auth0OrgName; docsUrl: DocsUrl }>(
    requiredPermOrPerms: AuthZPermission | AuthZPermission[],
    handler: (req: NextRequest, body: TBody, session: ApiSessionData) => Promise<NextResponse>
) {
    const requiredPerms = Array.isArray(requiredPermOrPerms) ? requiredPermOrPerms : [requiredPermOrPerms];

    return async (req: NextRequest, body: TBody): Promise<NextResponse> => {
        const { orgName, docsUrl } = body;

        // 1) Validate session
        const sessionResult = await maybeGetCurrentSession(req);
        if (sessionResult.errorResponse != null) {
            return sessionResult.errorResponse;
        }
        const { token, userId, permissions: sessionPerms } = sessionResult.data;

        // 2) Get org ID
        let orgId = sessionResult.data.orgId;
        if (orgId == null) {
            try {
                orgId = await getOrgIdFromName(orgName);
            } catch (error) {
                console.error("[withAuthZPermissions] Failed to resolve orgId", error);
                return NextResponse.json({ error: "Failed to fetch requested organization." }, { status: 404 });
            }
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
                    {
                        error: `User does not have required permissions to perform this request for this organization.`
                    },
                    { status: 403 }
                );
            }
        }

        // 5) Check user has "view" access to this docsUrl
        const canViewDocsUrl = await hasResourcePermission({
            sessionPermissions: sessionPerms,
            userId,
            orgId,
            permissionToCheck: "view",
            resourceType: "docs",
            resourceId: docsUrl
        });
        if (!canViewDocsUrl) {
            return NextResponse.json(
                { error: "User does not have required permissions to perform this request for this docs site." },
                { status: 403 }
            );
        }

        return await handler(req, body, sessionResult.data);
    };
}
