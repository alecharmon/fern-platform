import { type NextRequest, NextResponse } from "next/server";

import type { ResolvedReturnType } from "@/utils/types";

import { maybeGetCurrentSession } from "../../utils/maybeGetCurrentSession";
import handler from "./handler";

export declare namespace createOrganization {
    export type Response = ResolvedReturnType<typeof handler>;
}

export async function POST(req: NextRequest) {
    const maybeSessionData = await maybeGetCurrentSession(req);
    if (maybeSessionData.errorResponse != null) {
        return maybeSessionData.errorResponse;
    }
    const { token } = maybeSessionData.data;

    try {
        const body = await req.json();
        const result = await handler(token, body);
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
    }
}
