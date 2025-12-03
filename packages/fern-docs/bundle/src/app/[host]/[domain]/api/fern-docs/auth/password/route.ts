import { signPasswordAuthJWT } from "@fern-api/docs-server/auth/password-auth";
import { withSecureCookie } from "@fern-api/docs-server/auth/with-secure-cookie";
import { COOKIE_FERN_TOKEN } from "@fern-api/docs-utils";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { getAuthEdgeConfig } from "@fern-docs/edge-config";
import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

interface PasswordAuthRequestBody {
    password: string;
}

export async function POST(
    req: NextRequest,
    props: { params: Promise<{ host: string; domain: string }> }
): Promise<NextResponse> {
    const { domain } = await props.params;

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

        // Compare the submitted password with the configured password using timing-safe comparison
        const submittedPassword = Buffer.from(body.password, "utf-8");
        const configuredPassword = Buffer.from(authConfig.password, "utf-8");

        // Perform constant-time comparison to prevent timing attacks
        const lengthsMatch = submittedPassword.length === configuredPassword.length;
        const passwordsMatch = lengthsMatch && timingSafeEqual(submittedPassword, configuredPassword);

        if (!passwordsMatch) {
            return NextResponse.json({ error: "Invalid password" }, { status: 401 });
        }

        // Password is correct - sign a JWT with standard fern structure
        const token = await signPasswordAuthJWT({ secret: jwtSecret });

        // Set the cookie on the actual request host (not x-fern-host)
        // so the browser sends it back on subsequent requests
        const cookieJar = await cookies();
        cookieJar.set(COOKIE_FERN_TOKEN, token, withSecureCookie(withDefaultProtocol(req.nextUrl.host)));

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error("[password-auth] Error during authentication:", error);
        return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
    }
}
