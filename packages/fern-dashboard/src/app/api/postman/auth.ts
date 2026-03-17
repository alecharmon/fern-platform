import crypto from "crypto";
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

    const expected = Buffer.from(`Bearer ${postmanApiKey}`);
    const provided = Buffer.from(authHeader);

    if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
        return {
            authorized: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        };
    }

    return { authorized: true };
}
