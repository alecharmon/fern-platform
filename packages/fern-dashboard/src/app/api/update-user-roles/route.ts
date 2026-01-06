import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertUserHasOrganizationAccess } from "@/app/services/dal/organization";
import type { ResolvedReturnType } from "@/utils/types";

import { maybeGetCurrentSession } from "../utils/maybeGetCurrentSession";
import { parseNextRequestBody } from "../utils/parseNextRequestBody";
import { orgNameValidator, userIdValidator } from "../utils/validators";
import handler from "./handler";

export declare namespace updateUserRoles {
    export type Request = z.infer<typeof UpdateUserRolesRequest>;
    export type Response = ResolvedReturnType<typeof handler>;
}

const rolesValidator = z.enum(["admin", "editor", "viewer", "cli"]);

export const UpdateUserRolesRequest = z.object({
    orgName: orgNameValidator,
    userId: userIdValidator,
    currentRoles: z.array(rolesValidator),
    newRoles: z.array(rolesValidator)
});

export async function POST(req: NextRequest) {
    const maybeSessionData = await maybeGetCurrentSession(req);
    if (maybeSessionData.errorResponse != null) {
        return maybeSessionData.errorResponse;
    }
    const { userId: currentUserId, token } = maybeSessionData.data;

    const parsedBody = await parseNextRequestBody(req, UpdateUserRolesRequest);
    if (parsedBody.errorResponse != null) {
        return parsedBody.errorResponse;
    }
    const { orgName, userId, currentRoles, newRoles } = parsedBody.data;

    await assertUserHasOrganizationAccess(token, orgName);

    return NextResponse.json(await handler({ currentUserId, orgName, userId, currentRoles, newRoles }));
}
