import { type NextRequest, NextResponse } from "next/server";

import { getOpenApiSpecByCollectionId } from "@/app/services/postman/openapi-repository";

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

    try {
        const spec = await getOpenApiSpecByCollectionId(collectionId);

        if (!spec) {
            return NextResponse.json({ error: "CollectionDoesNotExist", collectionId }, { status: 404 });
        }

        // The collection has been processed and stored, so it's published
        const response: GetCollectionStatusResponse = {
            type: "published",
            url: `https://${collectionId}.docs.buildwithfern.com`,
            publishedAt: spec.created_at
        };

        return NextResponse.json<GetCollectionStatusResponse>(response);
    } catch (error) {
        console.error(`[postman-status] Error checking status for collection ${collectionId}:`, error);
        const response: GetCollectionStatusResponse = {
            type: "failed",
            reason: "Failed to check collection status"
        };
        return NextResponse.json<GetCollectionStatusResponse>(response, { status: 500 });
    }
}
