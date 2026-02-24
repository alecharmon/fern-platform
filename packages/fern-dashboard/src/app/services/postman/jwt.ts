import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

export function getPostmanBaseUrl(): string {
    const baseUrl = process.env.POSTMAN_API_BASE_URL;
    if (!baseUrl) {
        return "https://api.getpostman.com";
    }
    return baseUrl;
}

function getClientId(): string {
    const clientId = process.env.POSTMAN_APP_CLIENT_ID;
    if (!clientId) {
        throw new Error("POSTMAN_APP_CLIENT_ID is not configured");
    }
    return clientId;
}

function getClientSecret(): string {
    const clientSecret = process.env.POSTMAN_APP_CLIENT_SECRET;
    if (!clientSecret) {
        throw new Error("POSTMAN_APP_CLIENT_SECRET is not configured");
    }
    return clientSecret;
}

interface GetPostmanAccessTokenRequest {
    teamId: string;
    installationAuthId: string;
    sharedSecret: string;
}

export async function getPostmanAccessToken(request: GetPostmanAccessTokenRequest): Promise<string> {
    const clientId = getClientId();
    const clientSecret = getClientSecret();
    const tokenUrl = `${getPostmanBaseUrl()}/oauth/token`;

    const now = Math.floor(Date.now() / 1000);
    const expire = now + 3600;

    const token = jwt.sign(
        {
            iss: clientId,
            aud: "https://api.getpostman.com/oauth/token",
            jti: uuidv4(),
            iat: now,
            exp: expire
        },
        request.sharedSecret,
        { algorithm: "HS256" }
    );

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${basicAuth}`
        },
        body: JSON.stringify({
            installationAuthId: request.installationAuthId,
            grant_type: "client_credentials",
            jwt: token
        })
    });

    if (!response.ok) {
        const body = await response.text();
        console.error(`[postman-api] Token request failed. tokenUrl=${tokenUrl} jwt=${token}`);
        throw new Error(`Failed to get access token: ${body}`);
    }

    const data = (await response.json()) as { access_token: string };
    return data.access_token;
}
