import { type ServiceJwtPayload, verifyServiceJwt } from "@fern-platform/service-jwt-auth";
import { NextResponse } from "next/server";

const BEARER_REGEX = /^bearer\s+/i;

/**
 * Authenticate a service JWT from the Authorization header.
 *
 * Returns the decoded payload on success, or a 401 NextResponse on failure.
 * Callers should check `auth instanceof NextResponse` to distinguish errors.
 */
export async function authenticateServiceJwt(req: Request): Promise<ServiceJwtPayload | NextResponse> {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
        return NextResponse.json({ error: "Authorization header required" }, { status: 401 });
    }

    const token = authHeader.replace(BEARER_REGEX, "");
    const result = await verifyServiceJwt(token, {
        issuer: "https://buildwithfern.com",
        audience: "dashboard-activity-log"
    });

    if (result.isErr()) {
        return NextResponse.json({ error: result.error.message }, { status: 401 });
    }

    return result.value;
}
