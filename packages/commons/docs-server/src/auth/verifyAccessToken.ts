import { createRemoteJWKSet, decodeJwt, type JWTPayload, jwtVerify } from "jose";

export async function decodeAccessToken(accessToken: string, jwksUrl?: string): Promise<JWTPayload> {
    if (jwksUrl == null) {
        return decodeJwt(accessToken);
    }
    const JWKS = createRemoteJWKSet(new URL(jwksUrl));
    const { payload } = await jwtVerify(accessToken, JWKS);
    return payload;
}
