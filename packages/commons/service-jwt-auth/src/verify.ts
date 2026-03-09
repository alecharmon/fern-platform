import { jwtVerify } from "jose";
import { err, ok, type Result } from "neverthrow";
import type { ServiceAuthError } from "./errors.js";
import { resolveSecret } from "./secret.js";
import type { ServiceJwtConfig, ServiceJwtPayload } from "./types.js";

export async function verifyServiceJwt(
    token: string,
    config: Omit<ServiceJwtConfig, "service">
): Promise<Result<ServiceJwtPayload, ServiceAuthError>> {
    const secret = resolveSecret(config.secret);
    if (secret.isErr()) {
        return err(secret.error);
    }

    let payload: ServiceJwtPayload;
    try {
        const result = await jwtVerify(token, secret.value, {
            issuer: config.issuer,
            audience: config.audience,
            algorithms: ["HS256"]
        });
        payload = result.payload as ServiceJwtPayload;
    } catch (error) {
        if (error instanceof Error && error.name === "JWTExpired") {
            return err({
                source: "service-jwt-auth",
                code: "TOKEN_EXPIRED",
                message: "JWT has expired",
                cause: error
            });
        }
        return err({
            source: "service-jwt-auth",
            code: "INVALID_TOKEN",
            message: `Invalid JWT: ${error instanceof Error ? error.message : String(error)}`,
            cause: error
        });
    }

    if (typeof payload.service !== "string" || payload.service.length === 0) {
        return err({
            source: "service-jwt-auth",
            code: "INVALID_SERVICE",
            message: "JWT is missing the service claim"
        });
    }

    return ok(payload);
}
