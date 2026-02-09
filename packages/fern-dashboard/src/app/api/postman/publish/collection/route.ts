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

    if (!body.collectionId) {
        return NextResponse.json({ error: "collectionId is required" }, { status: 400 });
    }

    if (!body.userId || !body.teamId) {
        return NextResponse.json({ error: "userId and teamId are required" }, { status: 400 });
    }

    const response: PublishCollectionResponse = {
        success: true,
        collectionId: body.collectionId,
        userId: body.userId,
        teamId: body.teamId,
        message: "Collection publish initiated"
    };

    return NextResponse.json<PublishCollectionResponse>(response);
}
