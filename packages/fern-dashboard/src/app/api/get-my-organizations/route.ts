import { type NextRequest, NextResponse } from "next/server";

import type { Auth0OrgName } from "@/app/services/auth0/types";
import type { ResolvedReturnType } from "@/utils/types";

import { maybeGetCurrentSession } from "../utils/maybeGetCurrentSession";
import handler from "./handler";

export declare namespace getMyOrganizations {
    export type Response = ResolvedReturnType<typeof handler>;
}

export async function GET(req: NextRequest) {
    const maybeSessionData = await maybeGetCurrentSession(req);
    if (maybeSessionData.errorResponse != null) {
        return maybeSessionData.errorResponse;
    }
    const { userId, permissions } = maybeSessionData.data;

    const orgName = req.nextUrl.searchParams.get("orgName") as Auth0OrgName | null;

    return NextResponse.json(await handler(userId, { orgName: orgName ?? undefined, permissions }));
}
