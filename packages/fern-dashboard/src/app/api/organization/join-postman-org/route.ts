import { addRoles } from "@fern-api/user-permissions";
import { type NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import * as auth0Management from "@/app/services/auth0/management";
import { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";
import { getVenusClient } from "@/app/services/venus/getVenusClient";

export async function POST(req: NextRequest) {
    const session = await getCurrentSession();
    if (session == null || session.accessToken == null) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { orgId, postmanTeamId } = body as { orgId?: string; postmanTeamId?: string };

    if (!orgId || !postmanTeamId) {
        return NextResponse.json({ error: "orgId and postmanTeamId are required" }, { status: 400 });
    }

    const userId = Auth0UserID(session.user.sub);

    try {
        // Add the user to the org in Venus
        const venus = getVenusClient({ token: session.accessToken });
        try {
            await venus.organization.addUser({ orgId, userId });
        } catch (error) {
            console.error(`[join-postman-org] Failed to add user to Venus org ${orgId}:`, error);
            // Continue — user may already be a member in Venus
        }

        // Update the organization to link it with the Postman team.
        // The Venus SDK (v0.22.34) does not yet include postmanTeamId in
        // UpdateOrganizationRequest, so we call the endpoint directly.
        try {
            const venusServerUrl = process.env.VENUS_SERVER_URL;
            if (venusServerUrl) {
                const resp = await fetch(`${venusServerUrl}/organizations/${encodeURIComponent(orgId)}/update`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.accessToken}`
                    },
                    body: JSON.stringify({ postmanTeamId })
                });
                if (!resp.ok) {
                    console.error(`[join-postman-org] Venus update returned ${resp.status} for org ${orgId}`);
                }
            }
        } catch (error) {
            console.error(`[join-postman-org] Failed to link org ${orgId} to Postman team ${postmanTeamId}:`, error);
            // Non-critical — user is still added to the org
        }

        // Add the user to the org in Auth0
        const orgName = Auth0OrgName(orgId);
        try {
            await auth0Management.addUserToOrg(userId, orgName);
        } catch (error) {
            console.error(`[join-postman-org] Failed to add user to Auth0 org ${orgName}:`, error);
            // If this fails, the user won't have access — return error
            return NextResponse.json({ error: "Failed to add user to organization" }, { status: 500 });
        }

        // Assign admin role to the user
        try {
            const auth0OrgId = await auth0Management.getOrgIdFromName(orgName);
            await addRoles({ userId, orgId: auth0OrgId, roleNames: ["admin"] });
        } catch (error) {
            console.error(`[join-postman-org] Failed to assign admin role to user ${userId} in org ${orgId}:`, error);
            // Non-critical — user is already added to the org
        }

        return NextResponse.json({ success: true, orgId });
    } catch (error) {
        console.error("[join-postman-org] Unexpected error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
