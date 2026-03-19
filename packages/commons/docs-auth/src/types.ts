import { z } from "zod";

export const PlaygroundStateSchema = z.object({
    auth: z
        .object({
            bearer_token: z.string().optional().describe("Bearer token to set in the request"),
            basic: z
                .object({
                    username: z.string(),
                    password: z.string()
                })
                .optional()
        })
        .optional(),
    headers: z.record(z.string(), z.string()).optional().describe("Headers to set in the request"),
    path_parameters: z.record(z.string(), z.any()).optional().describe("Path parameters to set in the request"),
    query_parameters: z.record(z.string(), z.any()).optional().describe("Query parameters to set in the request")
    // TODO: support body injection (potentially leveraging jsonpath?) — need a way to support different content types, and different spec types
});

export const FernUserSchema = z.object({
    /**
     * Subject identifier from the JWT's root-level sub claim.
     * Used as user_id for analytics (e.g., Google Analytics).
     * This is populated from the JWT's root `sub` claim, not from the `fern` payload.
     */
    sub: z.string().optional(),
    name: z.string().optional(),
    email: z.string().optional(),
    roles: z
        .array(z.string())
        .describe(
            "The roles of the token (can be a string or an array of strings) which limits what content users can access"
        )
        .optional(),

    // TODO: deprecate this
    api_key: z.string().optional().describe("For API Playground key injection"),

    /**
     * when the user logs in, there may be some initial state in the API playground that we can replace with the user's information (i.e. api key, organization, project id, etc.)
     *
     * the initial state will be merged into each request if it's compatible with the api endpoint's spec.
     *
     * Example claim:
     * ```
     * {
     *     "playground": {
     *         "initial_state": {
     *             "auth": {
     *                 "bearer_token": "abc123"
     *             }
     *         }
     *     }
     * }
     *
     * there is an environment-specific state that will be merged into a request
     * if the selected environment matches the key of the env_state record
     *
     *    * Example claim:
     * ```
     * {
     *     "playground": {
     *         "env_state": {
     *             "prod.example.api": {
     *                "auth": {
     *                  "bearer_token": "abc123"
     *                }
     *             },
     *             "dev.example.api": {
     *                "auth": {
     *                  "bearer_token": "123abc"
     *                }
     *             }
     *         }
     *     }
     * }
     */
    playground: z
        .object({
            initial_state: PlaygroundStateSchema.optional(),
            env_state: z.record(z.string(), PlaygroundStateSchema).optional()
        })
        .optional()
});

export const PathnameViewerRulesSchema = z.object({
    allowlist: z
        .array(z.string())
        .describe("List of pages (regexp allowed) that are public and do not require authentication")
        .optional(),
    denylist: z
        .array(z.string())
        .describe("List of pages (regexp allowed) that are private and require authentication")
        .optional(),
    anonymous: z
        .array(z.string())
        .describe(
            "List of pages (regexp allowed) that are public and do not require authentication, but are hidden when the user is authenticated"
        )
        .optional()
});

// WorkOS is our only SSO provider for now, and is meant for private docs.
export const SSOWorkOSSchema = z
    .object({
        type: z.literal("sso"),
        partner: z.literal("workos"),
        organization: z.string().describe("This should be the org name, NOT the org ID"),
        connection: z
            .string()
            .optional()
            .describe("The WorkOS SSO connection ID to use for authentication (if you want to skip Authkit)"),
        provider: z.string().optional().describe("Provider (if you want to skip Authkit for social login)"),
        domainHint: z.string().optional().describe("Domain hint for social login"),
        loginHint: z.string().optional().describe("Login hint for social login")
    })
    .merge(PathnameViewerRulesSchema);

export const APIPlaygroundEdgeConfigSchema = z.object({
    "api-key-injection-enabled": z
        .optional(z.boolean())
        .describe("When true, API playground will render a login box instead of the API key input")
});

export const OAuth2SharedSchema = z
    .object({
        type: z.literal("oauth2"),
        clientId: z.string(),
        clientSecret: z.string(),
        redirectUri: z.string().optional(),
        logout: z.string().optional()
    })
    .merge(APIPlaygroundEdgeConfigSchema)
    .merge(PathnameViewerRulesSchema);

// used for generalized authorization_code oauth2 flow
export const OAuth2ClientCredentialsSchema = OAuth2SharedSchema.extend({
    partner: z.string(),
    auth_endpoint: z.string(),
    token_endpoint: z.string(),
    scope: z.optional(z.union([z.string(), z.array(z.string())])),
    issuer: z.optional(z.string()),
    roles_claim: z.optional(z.string()).describe("The access token claim to parse for roles. Defaults to 'roles'")
});

export const OAuth2Schema = OAuth2ClientCredentialsSchema;

export const BasicTokenVerificationSchema = z
    .object({
        type: z.literal("basic_token_verification"),
        secret: z.string(),
        issuer: z.string(),
        redirect: z.string(),
        logout: z.string().optional(),
        returnToQueryParam: z
            .string()
            .optional()
            .describe(
                "By default, this is 'state' because most auth platforms are able to support carrying over the state query parameter. Override this to `return_to` if the state parameter conflicts with the customer's auth provider in any way."
            )
    })
    .merge(APIPlaygroundEdgeConfigSchema)
    .merge(PathnameViewerRulesSchema);

export const PasswordEntrySchema = z.object({
    password: z.string(),
    roles: z.array(z.string())
});

export const PasswordAuthSchema = z
    .object({
        type: z.literal("password")
    })
    .and(
        z.union([
            z.object({
                password: z.string(),
                passwords: z.undefined().optional()
            }),
            z.object({
                password: z.string().optional(),
                passwords: z.array(PasswordEntrySchema).min(1)
            })
        ])
    )
    .and(PathnameViewerRulesSchema);

export const AuthEdgeConfigSchema = z.union([
    SSOWorkOSSchema,
    OAuth2Schema,
    BasicTokenVerificationSchema,
    PasswordAuthSchema
]);

export const OAuthTokenResponseSchema = z.object({
    access_token: z.string(),
    expires_in: z.number().optional(),
    refresh_token: z.string().optional(),
    scope: z.string().optional(),
    token_type: z.string().optional()
});

export const JwkSchema = z.object({
    kty: z.string().describe("Key Type"),
    use: z.string().optional().describe("Public Key Use"),
    key_ops: z.array(z.string()).optional().describe("Key Operations"),
    alg: z.string().optional().describe("Algorithm"),
    kid: z.string().optional().describe("Key ID"),
    x5u: z.string().optional().describe("X.509 URL"),
    x5c: z.array(z.string()).optional().describe("X.509 Certificate Chain"),
    x5t: z.string().optional().describe("X.509 Certificate SHA-1 Thumbprint"),
    "x5t#S256": z.string().optional().describe("X.509 Certificate SHA-256 Thumbprint")
});

export const JwksSchema = z.object({
    keys: z.array(JwkSchema).describe("Array of JWKs")
});

export const ApiKeySchema = z.object({
    apiKey: z.string(),
    secret: z.string(),
    payload: z
        .object({
            fern: FernUserSchema
        })
        .optional()
});

export type ApiKeyDemo = z.infer<typeof ApiKeySchema>;
export type FernUser = z.infer<typeof FernUserSchema>;
export type PlaygroundState = z.infer<typeof PlaygroundStateSchema>;
export type AuthEdgeConfig = z.infer<typeof AuthEdgeConfigSchema>;
export type SSOWorkOS = z.infer<typeof SSOWorkOSSchema>;
export type PasswordEntry = z.infer<typeof PasswordEntrySchema>;
export type PasswordAuth = z.infer<typeof PasswordAuthSchema>;
export type OAuth2ClientCredentials = z.infer<typeof OAuth2ClientCredentialsSchema>;
export type BasicTokenVerification = z.infer<typeof BasicTokenVerificationSchema>;
export type OAuth2 = z.infer<typeof OAuth2Schema>;
export type OAuthTokenResponse = z.infer<typeof OAuthTokenResponseSchema>;
export type Jwk = z.infer<typeof JwkSchema>;
export type Jwks = z.infer<typeof JwksSchema>;
export type PathnameViewerRules = z.infer<typeof PathnameViewerRulesSchema>;
