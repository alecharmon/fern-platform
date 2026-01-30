import { type NextRequest, NextResponse } from "next/server";

import { validatePostmanAuth } from "../../../../auth";
import type { GetCollectionStatusResponse } from "../../../../types";

interface RouteParams {
    params: Promise<{
        collectionId: string;
    }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
    const authCheck = validatePostmanAuth(request);
    if (!authCheck.authorized) {
        return authCheck.response;
    }

    const { collectionId } = await params;

    if (!collectionId) {
        return NextResponse.json({ error: "collectionId is required" }, { status: 400 });
    }

    const response: GetCollectionStatusResponse = {
        type: "published",
        url: `https://docs.example.com/${collectionId}`,
        publishedAt: new Date().toISOString()
    };

    return NextResponse.json<GetCollectionStatusResponse>(response);
}
