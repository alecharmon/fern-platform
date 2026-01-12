import { signFernJWT, verifyFernJWT } from "./FernJWT";

const PASSWORD_AUTH_ROLE = "authenticated";

interface SignPasswordAuthOptions {
    secret: string;
    authMethod?: string;
}

export async function signPasswordAuthJWT({ secret, authMethod }: SignPasswordAuthOptions): Promise<string> {
    return signFernJWT({ roles: [PASSWORD_AUTH_ROLE] }, { secret, authMethod });
}

export async function verifyPasswordAuthJWT(
    token: string,
    secret: string
): Promise<{ valid: true; roles: string[] } | { valid: false }> {
    try {
        const fernUser = await verifyFernJWT(token, secret);
        return {
            valid: true,
            roles: fernUser.roles ?? []
        };
    } catch {
        return { valid: false };
    }
}

export async function safeVerifyPasswordAuth(
    token: string | undefined,
    secret: string
): Promise<{ valid: true; roles: string[] } | { valid: false }> {
    if (!token) {
        return { valid: false };
    }
    return verifyPasswordAuthJWT(token, secret);
}
