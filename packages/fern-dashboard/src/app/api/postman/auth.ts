import { type NextRequest, NextResponse } from "next/server";

export interface PostmanAuthResult {
    authorized: true;
}

export interface PostmanAuthError {
    authorized: false;
    response: NextResponse;
}

export type PostmanAuthCheck = PostmanAuthResult | PostmanAuthError;

export function validatePostmanAuth(request: NextRequest): PostmanAuthCheck {
    const authHeader = request.headers.get("authorization");
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    const postmanApiKey = process.env.POSTMAN_FERN_API_KEY;

    if (!postmanApiKey) {
        console.error("[postman-api] POSTMAN_FERN_API_KEY not configured");
        return {
            authorized: false,
            response: NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
        };
    }

    if (!authHeader) {
        return {
            authorized: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        };
    }

    if (authHeader !== `Bearer ${postmanApiKey}`) {
        return {
            authorized: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        };
    }

    return { authorized: true };
}
