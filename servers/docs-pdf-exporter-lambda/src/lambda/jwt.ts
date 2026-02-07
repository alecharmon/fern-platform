import { SignJWT } from "jose";
import { env } from "./env";

const encoder = new TextEncoder();

let cachedJwt: string | undefined;
let cachedJwtExpiryMs: number | undefined;

export async function getServiceJwt(): Promise<string> {
    const now = Date.now();
    if (cachedJwt != null && cachedJwtExpiryMs != null && now < cachedJwtExpiryMs) {
        return cachedJwt;
    }
    const token = await new SignJWT({ service: "docs-pdf-exporter-lambda" })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setIssuedAt()
        .setExpirationTime("15m")
        .setIssuer("https://buildwithfern.com")
        .setAudience("fdr")
        .sign(getJwtSecret());
    cachedJwt = token;
    cachedJwtExpiryMs = now + 10 * 60 * 1000;
    return token;
}

function getJwtSecret(): Uint8Array {
    return encoder.encode(env.PDF_EXPORT_JWT_SECRET_KEY);
}
