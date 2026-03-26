import { type NextRequest, NextResponse } from "next/server";

import { verifyInternalAuth } from "@/app/api/utils/verifyAuth";

export async function GET(req: NextRequest) {
    const auth = await verifyInternalAuth(req);
    if (auth.errorResponse != null) {
        return auth.errorResponse;
    }

    return NextResponse.json({ ok: true });
}
