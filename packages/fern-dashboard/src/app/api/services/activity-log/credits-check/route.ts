import { type NextRequest, NextResponse } from "next/server";

import { authenticateServiceJwt } from "../_utils/authenticateServiceJwt";
import { CreditsCheckQuerySchema } from "../_utils/schemas";
import handler from "./handler";

export async function GET(req: NextRequest) {
    const auth = await authenticateServiceJwt(req);
    if (auth instanceof NextResponse) {
        return auth;
    }

    try {
        const parsed = CreditsCheckQuerySchema.safeParse({
            org_id: req.nextUrl.searchParams.get("org_id")
        });
        if (!parsed.success) {
            console.error("[credits-check] Zod validation failed:", JSON.stringify(parsed.error.issues));
            return NextResponse.json({ error: parsed.error.message }, { status: 400 });
        }
        const result = await handler(parsed.data);
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
    }
}
