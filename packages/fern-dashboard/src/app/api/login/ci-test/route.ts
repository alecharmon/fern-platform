import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import z from "zod";

const RequestSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
    redirect_on_login: z.string().optional()
});

interface Auth0TokenResponse {
    access_token: string;
    id_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
}

interface IdTokenPayload {
    sub: string;
    name?: string;
    nickname?: string;
    picture?: string;
    email?: string;
    email_verified?: boolean;
    iss: string;
    aud: string;
    iat: number;
    exp: number;
}

/**
 * CI Test Login API Route
 *
 * This endpoint allows automated testing by authenticating via Auth0's
 * Resource Owner Password Grant (ROPG). It's only accessible when the
 * FERN_CI_AUTOMATED_TESTING env var is configured.
 *
 * Requirements:
 * 1. Enable "Password" grant type in Auth0 Application settings
 * 2. Enable "Username-Password-Authentication" database connection
 * 3. Create test users in that connection
 */
export async function POST(request: Request) {
    // Verify CI testing is enabled
    const ciTestingSecret = process.env.FERN_CI_AUTOMATED_TESTING;
    if (!ciTestingSecret) {
        return NextResponse.json({ error: "CI testing not enabled" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { email, password, redirect_on_login } = RequestSchema.parse(body);

        const domain = process.env.AUTH0_DOMAIN;
        const clientId = process.env.AUTH0_CLIENT_ID;
        const clientSecret = process.env.AUTH0_CLIENT_SECRET;
        const audience = process.env.NEXT_PUBLIC_VENUS_AUDIENCE;

        if (!domain || !clientId || !clientSecret) {
            console.error("Missing Auth0 configuration");
            return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
        }

        // Connection name for the database connection (defaults to "Username-Password-Authentication")
        // Can be overridden via CI_TEST_AUTH0_CONNECTION env var if needed
        const connection = process.env.CI_TEST_AUTH0_CONNECTION;

        // Call Auth0's token endpoint with Resource Owner Password Grant
        const tokenResponse = await fetch(`https://${domain}/oauth/token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                grant_type: "password",
                username: email,
                password: password,
                client_id: clientId,
                client_secret: clientSecret,
                audience: audience,
                scope: "openid profile email offline_access",
                realm: connection
            })
        });

        if (!tokenResponse.ok) {
            const errorData = (await tokenResponse.json()) as { error_description?: string };
            console.error("Auth0 ROPG failed:", errorData);
            return NextResponse.json(
                { error: errorData.error_description ?? "Authentication failed" },
                { status: 401 }
            );
        }

        const tokens = (await tokenResponse.json()) as Auth0TokenResponse;

        // Decode the id_token to get user information
        const idTokenPayload = jwt.decode(tokens.id_token) as IdTokenPayload | null;
        if (!idTokenPayload) {
            return NextResponse.json({ error: "Invalid token response" }, { status: 500 });
        }

        // Store tokens in a CI-specific session cookie
        // This cookie will be checked by a CI-aware session handler
        const ciSession = {
            user: {
                sub: idTokenPayload.sub,
                name: idTokenPayload.name,
                nickname: idTokenPayload.nickname,
                picture: idTokenPayload.picture,
                email: idTokenPayload.email,
                email_verified: idTokenPayload.email_verified
            },
            accessToken: tokens.access_token,
            idToken: tokens.id_token,
            refreshToken: tokens.refresh_token,
            expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in
        };

        const cookieStore = await cookies();

        // Set the CI session cookie (encrypted with a simple base64 for now)
        // In production, you'd want to use proper encryption
        const sessionData = Buffer.from(JSON.stringify(ciSession)).toString("base64");

        cookieStore.set("ci_test_session", sessionData, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: tokens.expires_in,
            path: "/"
        });

        const redirectPath = redirect_on_login?.startsWith("/") ? redirect_on_login : "/";

        return NextResponse.json({ redirectUrl: redirectPath });
    } catch (error) {
        console.error("CI test login failed:", error);

        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }

        return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
    }
}
