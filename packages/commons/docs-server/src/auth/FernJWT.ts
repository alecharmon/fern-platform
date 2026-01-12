import { type AuthEdgeConfig, type FernUser, FernUserSchema, findAuthConfigById } from "@fern-api/docs-auth";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

import { getJwtSecretKey } from "./workos";
import { getSessionFromToken, toSessionUserInfo } from "./workos-session";
import { toFernUser } from "./workos-user-to-fern-user";

// "user" is reserved for workos

export const FernJWTPayloadSchema = z.object({
    fern: FernUserSchema.optional(),
    auth_method: z
        .string()
        .optional()
        .describe("The auth method ID used to authenticate. Used to identify which auth config to use for validation."),
    refresh_token: z.string().optional()
});

export type FernJWTPayload = z.infer<typeof FernJWTPayloadSchema>;

interface Opts {
    secret?: string;
    issuer?: string;
    authMethod?: string;
}
export function signFernJWT(fern: FernUser, { secret, issuer, authMethod }: Opts = {}): Promise<string> {
    const payload: FernJWTPayload = { fern };
    if (authMethod) {
        payload.auth_method = authMethod;
    }
    return new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setIssuedAt()
        .setExpirationTime("30d")
        .setIssuer(issuer ?? "https://buildwithfern.com")
        .sign(getJwtTokenSecret(secret));
}

export interface VerifyFernJWTResult {
    user: FernUser;
    authMethod?: string;
}

export async function verifyFernJWT(token: string, secret?: string, issuer?: string): Promise<FernUser> {
    const result = await verifyFernJWTWithAuthMethod(token, secret, issuer);
    return result.user;
}

export async function verifyFernJWTWithAuthMethod(
    token: string,
    secret?: string,
    issuer?: string
): Promise<VerifyFernJWTResult> {
    const verified = await jwtVerify(token, getJwtTokenSecret(secret), {
        issuer: issuer ?? "https://buildwithfern.com"
    });
    // if the token is undefined, FernUser will be an empty object
    const user = FernUserSchema.optional().parse(verified.payload.fern) ?? {};
    // Extract sub from the root JWT payload and add it to the FernUser
    const sub = typeof verified.payload.sub === "string" ? verified.payload.sub : undefined;
    // Extract auth_method from the payload
    const authMethod = typeof verified.payload.auth_method === "string" ? verified.payload.auth_method : undefined;
    return { user: { ...user, sub }, authMethod };
}

export function extractAuthMethodFromToken(token: string): string | undefined {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) {
            return undefined;
        }
        const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString());
        return typeof payload.auth_method === "string" ? payload.auth_method : undefined;
    } catch {
        return undefined;
    }
}

export async function verifyFernJWTConfig(token: string, authConfig: AuthEdgeConfig | undefined): Promise<FernUser> {
    if (!authConfig) {
        throw new Error("Auth config is undefined");
    }

    if (authConfig.type === "basic_token_verification") {
        return verifyFernJWT(token, authConfig.secret, authConfig.issuer);
    }

    if (authConfig.type === "oauth2" && "auth_endpoint" in authConfig) {
        return verifyFernJWT(token, process.env.OAUTH_JWT_SECRET, authConfig.issuer);
    }

    if (authConfig.type === "sso" && authConfig.partner === "workos") {
        const session = await toSessionUserInfo(await getSessionFromToken(token));
        if (session.user) {
            return toFernUser(session);
        } else {
            throw new Error("Invalid WorkOS session");
        }
    }

    throw new Error("Auth config type is not supported");
}

export async function safeVerifyFernJWTConfig(
    token: string | undefined,
    authConfig: AuthEdgeConfig | undefined
): Promise<FernUser | undefined> {
    try {
        if (token) {
            return await verifyFernJWTConfig(token, authConfig);
        }
    } catch (e) {
        console.debug(String(e));
    }

    return undefined;
}

export async function verifyFernJWTWithMultipleConfigs(
    token: string,
    authConfigs: AuthEdgeConfig[]
): Promise<FernUser> {
    if (authConfigs.length === 0) {
        throw new Error("No auth configs provided");
    }

    const authMethodFromToken = extractAuthMethodFromToken(token);

    if (authMethodFromToken) {
        const matchingConfig = findAuthConfigById(authConfigs, authMethodFromToken);
        if (matchingConfig) {
            return verifyFernJWTConfig(token, matchingConfig);
        }
        console.debug(`Auth method ${authMethodFromToken} from token not found in configs, trying all configs`);
    }

    for (const config of authConfigs) {
        try {
            return await verifyFernJWTConfig(token, config);
        } catch {
            continue;
        }
    }

    throw new Error("Token could not be verified with any auth config");
}

export async function safeVerifyFernJWTWithMultipleConfigs(
    token: string | undefined,
    authConfigs: AuthEdgeConfig[]
): Promise<FernUser | undefined> {
    try {
        if (token && authConfigs.length > 0) {
            return await verifyFernJWTWithMultipleConfigs(token, authConfigs);
        }
    } catch (e) {
        console.debug(String(e));
    }

    return undefined;
}

const encoder = new TextEncoder();

function getJwtTokenSecret(secret?: string): Uint8Array {
    return encoder.encode(secret ?? getJwtSecretKey());
}
