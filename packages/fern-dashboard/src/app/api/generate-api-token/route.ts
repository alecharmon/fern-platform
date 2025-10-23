import { NextResponse } from "next/server";

import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import { getVenusClient } from "@/app/services/venus/getVenusClient";

export declare namespace generateApiToken {
    export interface Request {
        organizationId: string;
    }

    export interface Response {
        token: string;
    }
}

export async function POST(request: Request): Promise<NextResponse<generateApiToken.Response>> {
    const session = await getCurrentSession();
    if (session == null) {
        return NextResponse.json({ error: "Unauthorized" } as any, { status: 401 });
    }

    const body = await request.json();
    const { organizationId } = body as generateApiToken.Request;

    if (!organizationId) {
        return NextResponse.json({ error: "Organization ID is required" } as any, { status: 400 });
    }

    await assertUserHasOrganizationAccess({
        token: session.accessToken,
        orgName: organizationId as Auth0OrgName
    });

    try {
        const venusClient = getVenusClient({ token: session.accessToken });

        const response = await venusClient.registry.generateRegistryTokens({
            organizationId
        });

        if (!response.ok) {
            console.error("Failed to generate API token:", response.error);
            return NextResponse.json({ error: "Failed to generate token" } as any, { status: 500 });
        }

        return NextResponse.json({ token: response.body.npm.token });
    } catch (error) {
        console.error("Error generating API token:", error);
        return NextResponse.json({ error: "Internal server error" } as any, { status: 500 });
    }
}
