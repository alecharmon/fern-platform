import { SignJWT } from "jose";
import { resolveSecret } from "./secret.js";
import type { SignServiceJwtConfig } from "./types.js";

export async function signServiceJwt(config: SignServiceJwtConfig): Promise<string> {
    const secret = resolveSecret(config.secret);
    if (secret.isErr()) {
        throw secret.error;
    }
    return new SignJWT({ service: config.service })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer(config.issuer)
        .setAudience(config.audience)
        .setExpirationTime(config.expiresIn ?? "1h")
        .sign(secret.value);
}
