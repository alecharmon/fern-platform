import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

const FIXED_STATE = "fixedstate";

interface PostmanJwtPayload {
    sub: string;
    email?: string;
    name?: string;
    iat: number;
    exp: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("jwt");
    const state = searchParams.get("state");

    if (!token) {
        return NextResponse.json({ error: "Missing jwt parameter" }, { status: 400 });
    }

    if (!state) {
        return NextResponse.json({ error: "Missing state parameter" }, { status: 400 });
    }

    if (state !== FIXED_STATE) {
        console.error("[postman/access/jwt] Invalid state parameter");
        return NextResponse.json({ error: "Invalid state" }, { status: 400 });
    }

    const postmanPublicKey = process.env.POSTMAN_JWT_PUBLIC_KEY;
    if (!postmanPublicKey) {
        console.error("[postman/access/jwt] POSTMAN_JWT_PUBLIC_KEY not configured");
        return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    try {
        const decoded = jwt.verify(token, postmanPublicKey, {
            algorithms: ["RS256"]
        }) as PostmanJwtPayload;

        const postmanSession = {
            user: {
                sub: decoded.sub,
                email: decoded.email,
                name: decoded.name
            },
            accessToken: token,
            expiresAt: decoded.exp
        };

        const cookieStore = await cookies();
        const sessionData = Buffer.from(JSON.stringify(postmanSession)).toString("base64");

        cookieStore.set("postman_session", sessionData, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: decoded.exp - Math.floor(Date.now() / 1000),
            path: "/"
        });

        return NextResponse.redirect(new URL("/", request.url));
    } catch (error) {
        console.error("[postman/access/jwt] JWT verification failed:", error);
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
}
