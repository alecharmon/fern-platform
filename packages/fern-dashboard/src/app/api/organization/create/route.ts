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
    const { token, userId } = maybeSessionData.data;
    try {
        const body = await req.json();
        console.log("BODY Create organization input:", body);
        const result = await handler(token, userId, body);
        console.log("Create organization result:", result);
        return NextResponse.json(result);
    } catch (error) {
        console.error("Error creating organization:", error);
        return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
    }
}
