import { type NextRequest, NextResponse } from "next/server";

import { getOpenApiSpecByCollectionId } from "@/app/services/postman/openapi-repository";

import { validatePostmanAuth } from "../../auth";
import type { CollectionDoesNotExistError } from "../../types";

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

    const spec = await getOpenApiSpecByCollectionId(collectionId);

    if (!spec) {
        return NextResponse.json<CollectionDoesNotExistError>(
            { error: "CollectionDoesNotExist", collectionId },
            { status: 404 }
        );
    }

    return NextResponse.json(spec.openapi_spec);
}
