import type { JWTPayload } from "jose";

export interface ServiceJwtPayload extends JWTPayload {
    service: string;
}

export interface ServiceJwtConfig {
    /** HS256 secret. Defaults to `process.env.JWT_SECRET_KEY` if omitted. */
    secret?: string;
    issuer: string;
    audience: string;
    service: string;
}

export interface SignServiceJwtConfig extends ServiceJwtConfig {
    expiresIn?: string;
}
