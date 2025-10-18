import { type NextRequest, NextResponse } from "next/server";

import type { ResolvedReturnType } from "@/utils/types";

import { maybeGetCurrentSession } from "../../utils/maybeGetCurrentSession";
import handler from "./handler";

export declare namespace deleteOrganization {
    export type Response = ResolvedReturnType<typeof handler>;
}

export async function POST(req: NextRequest) {
    const maybeSessionData = await maybeGetCurrentSession(req);
    if (maybeSessionData.errorResponse != null) {
        console.error("[DELETE_ORG] Session error:", maybeSessionData.errorResponse);
        return maybeSessionData.errorResponse;
    }
    const { token } = maybeSessionData.data;

    try {
        const body = await req.json();
        console.log("[DELETE_ORG] Request body:", body);
        const result = await handler(token, body);
        console.log("[DELETE_ORG] Success:", result);
        return NextResponse.json(result);
    } catch (error) {
        console.error("[DELETE_ORG] Error:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
    }
}
