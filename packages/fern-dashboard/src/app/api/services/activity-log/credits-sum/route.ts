import { type NextRequest, NextResponse } from "next/server";

import { authenticateServiceJwt } from "../_utils/authenticateServiceJwt";
import { SumCreditsSchema } from "../_utils/schemas";
import handler from "./handler";

export async function POST(req: NextRequest) {
    const auth = await authenticateServiceJwt(req);
    if (auth instanceof NextResponse) {
        return auth;
    }

    try {
        const json = await req.json();
        const parsed = SumCreditsSchema.safeParse(json);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.message }, { status: 400 });
        }
        const result = await handler(parsed.data);
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
    }
}
