import { type NextRequest, NextResponse } from "next/server";

import { validatePostmanAuth } from "../auth";
import type { CheckResponse } from "../types";

export async function GET(request: NextRequest): Promise<NextResponse> {
    const authCheck = validatePostmanAuth(request);
    if (!authCheck.authorized) {
        return authCheck.response;
    }

    const response: CheckResponse = { ok: true };
    return NextResponse.json<CheckResponse>(response);
}
