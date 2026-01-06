import { getUserRoles, type UserRolePerResource } from "@fern-api/user-permissions";
import { NextResponse } from "next/server";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import { getOrgIdFromName } from "@/app/services/auth0/management";
import type { Auth0OrgName, Auth0UserID } from "@/app/services/auth0/types";

export declare namespace getUserResourceRoles {
    export interface Request {
        orgName: Auth0OrgName;
        userId: Auth0UserID;
    }

    export interface Response {
        ok: boolean;
        resourceRoles?: UserRolePerResource[];
        error?: string;
    }
}

export async function POST(req: Request): Promise<NextResponse<getUserResourceRoles.Response>> {
    const session = await getCurrentSession();
    if (!session) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as getUserResourceRoles.Request;
    const { orgName, userId } = body;

    if (!orgName || !userId) {
        return NextResponse.json({ ok: false, error: "orgName and userId are required" }, { status: 400 });
    }

    try {
        const orgId = await getOrgIdFromName(orgName);
        const resourceRoles = await getUserRoles({
            orgId,
            userId
        });

        return NextResponse.json({
            ok: true,
            resourceRoles
        });
    } catch (error) {
        console.error("Failed to fetch user resource roles:", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Failed to fetch resource roles"
        });
    }
}
