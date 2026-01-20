import { type NextRequest, NextResponse } from "next/server";

import { z } from "zod";

import * as auth0Management from "@/app/services/auth0/management";
import { parseDocsUrlParam } from "@/utils/parseDocsUrlParam";
import type { ResolvedReturnType } from "@/utils/types";
import { maybeGetCurrentSession } from "../utils/maybeGetCurrentSession";
import { parseNextRequestBody } from "../utils/parseNextRequestBody";
import handler from "./handler";

export declare namespace getDocsUrlOwner {
    export type Request = z.infer<typeof GetDocsUrlOwnerRequest>;
    export type Response = ResolvedReturnType<typeof handler>;
}

const GetDocsUrlOwnerRequest = z.object({
    url: z.string()
});

export async function POST(req: NextRequest) {
    const maybeSessionData = await maybeGetCurrentSession(req);
    if (maybeSessionData.errorResponse != null) {
        return maybeSessionData.errorResponse;
    }
    const { userId, token, permissions } = maybeSessionData.data;

    const parsedBody = await parseNextRequestBody(req, GetDocsUrlOwnerRequest);
    if (parsedBody.errorResponse != null) {
        return parsedBody.errorResponse;
    }
    const { url } = parsedBody.data;

    let response = await handler({ token, url: parseDocsUrlParam({ docsUrl: url }) });
    if (response.orgName != null) {
        const doesUserBelongToOrg = await auth0Management.doesUserBelongToOrg(userId, response.orgName, {
            permissions
        });
        if (!doesUserBelongToOrg) {
            response = { orgName: undefined };
        }
    }

    return NextResponse.json(response);
}
