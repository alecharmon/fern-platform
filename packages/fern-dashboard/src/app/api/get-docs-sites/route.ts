import { NextResponse } from "next/server";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { Auth0OrgName } from "@/app/services/auth0/types";
import getDocsSitesForOrg from "@/app/services/dal/fdr/getDocsSitesForOrg";
import { getDocsSiteUrl } from "@/utils/getDocsSiteUrl";

export declare namespace getDocsSites {
    export interface Request {
        orgName: Auth0OrgName;
    }

    export interface Response {
        ok: boolean;
        docsSites?: Array<{
            url: string;
        }>;
        error?: string;
    }
}

export async function POST(req: Request): Promise<NextResponse<getDocsSites.Response>> {
    const session = await getCurrentSession();
    if (!session) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as getDocsSites.Request;
    const { orgName } = body;

    if (!orgName) {
        return NextResponse.json({ ok: false, error: "orgName is required" }, { status: 400 });
    }

    const response = await getDocsSitesForOrg({
        orgName,
        token: session.accessToken
    });

    if (!response.ok) {
        return NextResponse.json({ ok: false, error: response.error.message ?? "Failed to fetch docs sites" });
    }

    return NextResponse.json({
        ok: true,
        docsSites: response.docsSites.map((site) => ({
            url: getDocsSiteUrl(site)
        }))
    });
}
