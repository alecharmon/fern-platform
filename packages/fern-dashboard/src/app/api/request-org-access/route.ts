import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentSessionOrThrow } from "@/app/services/auth0/getCurrentSession";
import type { ResolvedReturnType } from "@/utils/types";

import { parseNextRequestBody } from "../utils/parseNextRequestBody";
import handler from "./handler";

const RequestOrgAccessRequest = z.object({
    docsUrl: z.string()
});

export declare namespace requestOrgAccess {
    export type Request = z.infer<typeof RequestOrgAccessRequest>;
    export type Response = ResolvedReturnType<typeof handler>;
}

export async function POST(req: NextRequest) {
    try {
        const session = await getCurrentSessionOrThrow();
        const parsedBody = await parseNextRequestBody(req, RequestOrgAccessRequest);

        if (parsedBody.errorResponse != null) {
            return parsedBody.errorResponse;
        }

        const { docsUrl } = parsedBody.data;

        if (!session.user.email) {
            return NextResponse.json({ error: "User email not found" }, { status: 400 });
        }

        const result = await handler({
            docsUrl,
            email: session.user.email,
            token: session.accessToken
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error in request-org-access route:", error);
        return NextResponse.json({ error: "Failed to request access" }, { status: 500 });
    }
}
