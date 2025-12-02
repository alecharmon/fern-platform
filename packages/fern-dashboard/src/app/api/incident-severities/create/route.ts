import { type NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { getCurrentSession } from "@/app/services/auth0/getCurrentSession";
import type { ResolvedReturnType } from "@/utils/types";
import { parseNextRequestBody } from "../../utils/parseNextRequestBody";
import createSeverity, { CreateSeverityRequestSchema } from "./handler";

export declare namespace CreateSeverity {
    export type Request = z.infer<typeof CreateSeverityRequestSchema>;
    export type Response = ResolvedReturnType<typeof createSeverity>;
}

export async function POST(request: NextRequest) {
    try {
        const session = await getCurrentSession();
        if (session == null) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const body = await parseNextRequestBody(request, CreateSeverityRequestSchema);
        if (body.errorResponse != null) {
            return body.errorResponse;
        }
        const result = await createSeverity(body.data);
        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
