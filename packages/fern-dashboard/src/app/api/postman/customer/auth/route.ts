import { type NextRequest, NextResponse } from "next/server";

import { validatePostmanAuth } from "../../auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
    const authCheck = validatePostmanAuth(request);
    if (!authCheck.authorized) {
        return authCheck.response;
    }

    return NextResponse.json({ ok: true });
}
