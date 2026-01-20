import { type NextRequest, NextResponse } from "next/server";

import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import type { ResolvedReturnType } from "@/utils/types";

import { maybeGetCurrentSession } from "../utils/maybeGetCurrentSession";
import { parseNextRequestBody } from "../utils/parseNextRequestBody";
import handler from "./handler";
import { UpdateUserPermissionsRequest } from "./validation";

export declare namespace updateUserPermissions {
    export type Request = UpdateUserPermissionsRequest;
    export type Response = ResolvedReturnType<typeof handler>;
}

export async function POST(req: NextRequest) {
    const maybeSessionData = await maybeGetCurrentSession(req);
    if (maybeSessionData.errorResponse != null) {
        return maybeSessionData.errorResponse;
    }
    const { userId: currentUserId, token } = maybeSessionData.data;

    const parsedBody = await parseNextRequestBody(req, UpdateUserPermissionsRequest);
    if (parsedBody.errorResponse != null) {
        return parsedBody.errorResponse;
    }
    const { orgName, userId, permissions } = parsedBody.data;

    await assertUserHasOrganizationAccess(token, orgName);

    return NextResponse.json(await handler({ currentUserId, orgName, userId, permissions }));
}
