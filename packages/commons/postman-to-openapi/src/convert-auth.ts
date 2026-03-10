import type { OpenAPISecurityRequirement, OpenAPISecurityScheme } from "./openapi-types.js";
import type { PostmanAuth, PostmanAuthAttribute } from "./postman-types.js";

interface AuthConversionResult {
    securitySchemes: Record<string, OpenAPISecurityScheme>;
    security: OpenAPISecurityRequirement[];
}

/**
 * Converts Postman auth configuration to OpenAPI security schemes and requirements.
 */
export function convertAuth(auth: PostmanAuth | null | undefined): AuthConversionResult {
    if (auth == null || auth.type === "noauth") {
        return { securitySchemes: {}, security: [] };
    }

    const securitySchemes: Record<string, OpenAPISecurityScheme> = {};
    const security: OpenAPISecurityRequirement[] = [];

    switch (auth.type) {
        case "bearer": {
            securitySchemes.bearerAuth = {
                type: "http",
                scheme: "bearer",
                bearerFormat: getAuthAttributeValue(auth.bearer, "token") ? "JWT" : undefined
            };
            security.push({ bearerAuth: [] });
            break;
        }
        case "basic": {
            securitySchemes.basicAuth = {
                type: "http",
                scheme: "basic"
            };
            security.push({ basicAuth: [] });
            break;
        }
        case "apikey": {
            const key = getAuthAttributeValue(auth.apikey, "key") ?? "X-API-Key";
            const inValue = getAuthAttributeValue(auth.apikey, "in") ?? "header";
            const location = inValue === "query" ? "query" : "header";

            securitySchemes.apiKeyAuth = {
                type: "apiKey",
                name: String(key),
                in: location
            };
            security.push({ apiKeyAuth: [] });
            break;
        }
        case "oauth2": {
            const grantType = getAuthAttributeValue(auth.oauth2, "grant_type");
            const authUrl = String(
                getAuthAttributeValue(auth.oauth2, "authUrl") ?? "https://example.com/oauth/authorize"
            );
            const tokenUrl = String(
                getAuthAttributeValue(auth.oauth2, "accessTokenUrl") ?? "https://example.com/oauth/token"
            );
            const scope = getAuthAttributeValue(auth.oauth2, "scope");
            const scopes: Record<string, string> = {};
            if (typeof scope === "string" && scope) {
                for (const s of scope.split(" ")) {
                    scopes[s] = "";
                }
            }

            if (grantType === "client_credentials") {
                securitySchemes.oauth2Auth = {
                    type: "oauth2",
                    flows: {
                        clientCredentials: {
                            tokenUrl,
                            scopes
                        }
                    }
                };
            } else if (grantType === "password_credentials" || grantType === "password") {
                securitySchemes.oauth2Auth = {
                    type: "oauth2",
                    flows: {
                        password: {
                            tokenUrl,
                            scopes
                        }
                    }
                };
            } else if (grantType === "implicit") {
                securitySchemes.oauth2Auth = {
                    type: "oauth2",
                    flows: {
                        implicit: {
                            authorizationUrl: authUrl,
                            scopes
                        }
                    }
                };
            } else {
                // Default to authorization_code
                securitySchemes.oauth2Auth = {
                    type: "oauth2",
                    flows: {
                        authorizationCode: {
                            authorizationUrl: authUrl,
                            tokenUrl,
                            scopes
                        }
                    }
                };
            }
            security.push({ oauth2Auth: [] });
            break;
        }
        case "digest": {
            securitySchemes.digestAuth = {
                type: "http",
                scheme: "digest"
            };
            security.push({ digestAuth: [] });
            break;
        }
        default:
            break;
    }

    return { securitySchemes, security };
}

function getAuthAttributeValue(attrs: PostmanAuthAttribute[] | undefined, key: string): unknown | undefined {
    if (!attrs) {
        return undefined;
    }
    const attr = attrs.find((a) => a.key === key);
    return attr?.value;
}
