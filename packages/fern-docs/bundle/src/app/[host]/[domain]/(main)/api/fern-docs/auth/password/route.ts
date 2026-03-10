import { preferPreview } from "@fern-api/docs-server/auth/origin";
import { matchPassword, signPasswordAuthJWT } from "@fern-api/docs-server/auth/password-auth";
import { withSecureCookie } from "@fern-api/docs-server/auth/with-secure-cookie";
import { COOKIE_FERN_TOKEN } from "@fern-api/docs-utils";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { getAuthEdgeConfig } from "@fern-docs/edge-config";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

interface PasswordAuthRequestBody {
    password: string;
}

export async function POST(
    req: NextRequest,
    props: { params: Promise<{ host: string; domain: string }> }
): Promise<NextResponse> {
    const { host, domain } = await props.params;

    const jwtSecret = process.env.JWT_SECRET_KEY;
    if (!jwtSecret) {
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    let body: PasswordAuthRequestBody;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (!body.password || typeof body.password !== "string") {
        return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    try {
        // Get the auth config from edge config
        const authConfig = await getAuthEdgeConfig(domain);

        if (!authConfig || authConfig.type !== "password") {
            return NextResponse.json({ error: "Password authentication is not configured" }, { status: 400 });
        }

        // Match the submitted password against the config (supports both singular and array)
        const result = matchPassword(authConfig, body.password);

        if (!result.matched) {
            return NextResponse.json({ error: "Invalid password" }, { status: 401 });
        }

        // Password is correct - sign a JWT with the matched roles
        const token = await signPasswordAuthJWT({ secret: jwtSecret, roles: result.roles });

        // Set cookie on customer domain using same pattern as middleware
        const cookieJar = await cookies();
        cookieJar.set(COOKIE_FERN_TOKEN, token, withSecureCookie(withDefaultProtocol(preferPreview(host, domain))));

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("[password-auth] Error during authentication:", error);
        return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
    }
}
