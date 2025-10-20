import { type NextRequest, NextResponse } from "next/server";

import type { ResolvedReturnType } from "@/utils/types";

import { maybeGetCurrentSession } from "../utils/maybeGetCurrentSession";
import handler from "./handler";

export declare namespace createIncident {
    export type Response = ResolvedReturnType<typeof handler>;
}

export async function POST(req: NextRequest) {
    // Authenticate the user
    const maybeSessionData = await maybeGetCurrentSession(req);
    if (maybeSessionData.errorResponse != null) {
        return maybeSessionData.errorResponse;
    }

    try {
        const body = await req.json();
        const result = await handler(body);
        return NextResponse.json(result);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        const statusCode = errorMessage.includes("required") ? 400 : 500;

        return NextResponse.json(
            {
                success: false,
                error: errorMessage
            },
            { status: statusCode }
        );
    }
}
