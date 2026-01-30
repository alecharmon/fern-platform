import { isAuthZPermission } from "@fern-api/user-permissions";
import { type NextRequest, NextResponse } from "next/server";
import getMyOrganizations from "@/app/api/get-my-organizations/handler";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { Auth0UserID } from "@/app/services/auth0/types";

export async function GET(request: NextRequest) {
    try {
        const orgId = request.nextUrl.searchParams.get("org_id");

        if (!orgId) {
            return NextResponse.json({ hasAccess: false, error: "org_id required" }, { status: 400 });
        }

        const session = await getCurrentSession();
        if (!session) {
            return NextResponse.json({ hasAccess: false, reason: "no_session" });
        }

        const userId = Auth0UserID(session.user.sub);

        // Check if user is a member of the organization
        const orgs = await getMyOrganizations(userId);
        const isMember = orgs.some((org) => org.id === orgId);

        // Check if the current token has org scope
        // The token should have the org_id claim if properly scoped
        const hasOrgScopedToken = session.orgId === orgId;

        // Check if user has any meaningful permissions in the token
        // This ensures the permission sync has been reflected in the token
        const permissions = (session.permissions ?? []).filter(isAuthZPermission);
        const hasPermissions = permissions.length > 0;

        // User has full access when:
        // 1. They are a member of the org
        // 2. Their token is scoped to the org
        // 3. They have at least one valid permission
        const hasAccess = isMember && hasOrgScopedToken && hasPermissions;

        return NextResponse.json({
            hasAccess,
            isMember,
            hasOrgScopedToken,
            hasPermissions,
            permissionCount: permissions.length
        });
    } catch (error) {
        console.error("[check-org-access] Error:", error);
        return NextResponse.json({ hasAccess: false, error: "internal_error" }, { status: 500 });
    }
}
