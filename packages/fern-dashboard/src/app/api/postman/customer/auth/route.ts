import { type NextRequest, NextResponse } from "next/server";

import { upsertAppInstallation } from "@/app/services/postman/repository";

import { validatePostmanAuth } from "../../auth";
import type { CustomerAuthRequest } from "../../types";

export async function POST(request: NextRequest): Promise<NextResponse> {
    const authCheck = validatePostmanAuth(request);
    if (!authCheck.authorized) {
        return authCheck.response;
    }

    let body: CustomerAuthRequest;
    try {
        body = (await request.json()) as CustomerAuthRequest;
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!body.payload) {
        return NextResponse.json({ error: "payload is required" }, { status: 400 });
    }

    const { payload } = body;

    if (!payload.teamId || !payload.sharedSecret || !payload.installationAuthId) {
        return NextResponse.json(
            { error: "teamId, sharedSecret, and installationAuthId are required" },
            { status: 400 }
        );
    }

    try {
        await upsertAppInstallation({
            teamId: payload.teamId,
            sharedSecret: payload.sharedSecret,
            appInstallationId: payload.installationAuthId,
            teamName: payload.teamName,
            teamDomain: payload.teamDomain
        });
    } catch (e) {
        console.error("[postman-api] Failed to store app installation:", e);
        return NextResponse.json({ error: "Failed to store app installation" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
