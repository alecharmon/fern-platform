import { NextResponse } from "next/server";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import {
    getAuth0ManagementClient,
    getOrgIdFromName,
    invalidateOrganizationCache
} from "@/app/services/auth0/management";
import { type Auth0Organization, Auth0OrgName } from "@/app/services/auth0/types";
import { convertToAuth0Organization } from "@/app/services/auth0/utils";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";

export declare namespace updateOrganizationLogo {
    export interface Request {
        organizationName: string;
        logoUrl: string;
    }

    export interface Response {
        organization: Auth0Organization;
    }
}

export async function POST(request: Request): Promise<NextResponse<updateOrganizationLogo.Response>> {
    const session = await getCurrentSession();
    if (session == null) {
        return NextResponse.json({ error: "Unauthorized" } as any, { status: 401 });
    }

    const body = await request.json();
    const { organizationName, logoUrl } = body as updateOrganizationLogo.Request;

    if (!organizationName) {
        return NextResponse.json({ error: "Organization name is required" } as any, { status: 400 });
    }

    if (!logoUrl) {
        return NextResponse.json({ error: "Logo URL is required" } as any, { status: 400 });
    }

    // Validate URL format
    try {
        new URL(logoUrl);
    } catch {
        return NextResponse.json({ error: "Invalid logo URL" } as any, { status: 400 });
    }

    const orgName = Auth0OrgName(organizationName);

    await assertUserHasOrganizationAccess(session.accessToken, orgName);

    try {
        const auth0 = getAuth0ManagementClient();
        const orgId = await getOrgIdFromName(orgName);

        // Update the organization branding with the new logo URL
        const { data: updatedOrg } = await auth0.organizations.update(
            { id: orgId },
            {
                branding: {
                    logo_url: logoUrl
                }
            }
        );

        // Invalidate the organization cache so the new logo appears immediately
        await invalidateOrganizationCache(orgName);

        return NextResponse.json({ organization: convertToAuth0Organization(updatedOrg) });
    } catch (error) {
        console.error("Error updating organization logo:", error);
        return NextResponse.json({ error: "Failed to update logo" } as any, { status: 500 });
    }
}
