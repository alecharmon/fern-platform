import { type NextRequest, NextResponse } from "next/server";

import { validatePostmanAuth } from "../../auth";
import type { PublishCollectionRequest, PublishCollectionResponse } from "../../types";

export async function POST(request: NextRequest): Promise<NextResponse> {
    const authCheck = validatePostmanAuth(request);
    if (!authCheck.authorized) {
        return authCheck.response;
    }

    let body: PublishCollectionRequest;
    try {
        body = (await request.json()) as PublishCollectionRequest;
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!body.payload) {
        return NextResponse.json({ error: "payload is required" }, { status: 400 });
    }

    const { payload } = body;

    if (!payload.collectionId) {
        return NextResponse.json({ error: "collectionId is required" }, { status: 400 });
    }

    if (!payload.userId || !payload.teamId) {
        return NextResponse.json({ error: "userId and teamId are required" }, { status: 400 });
    }

    const response: PublishCollectionResponse = {
        success: true,
        collectionId: payload.collectionId,
        userId: payload.userId,
        teamId: payload.teamId,
        message: "Collection publish initiated"
    };

    return NextResponse.json<PublishCollectionResponse>(response);
}
