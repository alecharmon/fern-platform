import { NextResponse } from "next/server";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import * as auth0Management from "@/app/services/auth0/management";
import { Auth0UserID } from "@/app/services/auth0/types";
import { getVenusClient } from "@/app/services/venus/getVenusClient";

export interface AvailableOrg {
    orgName: string;
    displayName: string;
}

export async function GET() {
    const session = await getCurrentSession();
    if (session == null || session.accessToken == null) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = Auth0UserID(session.user.sub);

    try {
        // Get the user's orgs from Auth0
        const userOrgs = await auth0Management.getMyOrganizations(userId);

        // Check each org via Venus to see if it already has a Postman team association
        const venus = getVenusClient({ token: session.accessToken });

        const orgsWithPostmanStatus = await Promise.all(
            userOrgs.map(async (org) => {
                try {
                    const response = await venus.organization.get(org.name);
                    if (response.ok) {
                        return {
                            org,
                            hasPostmanTeam: response.body.postmanTeamId != null
                        };
                    }
                    // If Venus call fails, include the org (don't filter it out)
                    return { org, hasPostmanTeam: false };
                } catch {
                    // If Venus call fails, include the org
                    return { org, hasPostmanTeam: false };
                }
            })
        );

        // Only return orgs that are NOT already associated with a Postman team
        const availableOrgs: AvailableOrg[] = orgsWithPostmanStatus
            .filter((item) => !item.hasPostmanTeam)
            .map((item) => ({
                orgName: item.org.name,
                displayName: item.org.display_name ?? item.org.name
            }));

        return NextResponse.json(availableOrgs);
    } catch (error) {
        console.error("[available-for-postman] Error fetching available orgs:", error);
        return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
    }
}
