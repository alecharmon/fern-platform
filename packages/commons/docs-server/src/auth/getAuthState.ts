import "server-only";

import type { AuthEdgeConfig, FernUser } from "@fern-api/docs-auth";
import { getAuthMethodId } from "@fern-api/docs-auth";
import { removeTrailingSlash } from "@fern-api/docs-utils";
import { withDefaultProtocol } from "@fern-api/ui-core-utils";
import { getAuthEdgeConfig, getPreviewUrlAuthConfig, type PreviewUrlAuth } from "@fern-docs/edge-config";
import type { AsyncOrSync } from "ts-essentials";

import { isLocal } from "../isLocal";
import { isSelfHosted } from "../isSelfHosted";
import { getAllowedRedirectUrls } from "./allowed-redirects";
import { safeVerifyFernJWTConfig } from "./FernJWT";
import { getOAuth2AuthorizationUrl } from "./oauth2";
import { preferPreview } from "./origin";
import { getOryAuthorizationUrl } from "./ory";
import { safeVerifyPasswordAuth } from "./password-auth";
import { getReturnToQueryParam } from "./return-to";
import { getWebflowAuthorizationUrl } from "./webflow";
import { getWorkosSSOAuthorizationUrl } from "./workos";
import { handleWorkosAuth } from "./workos-handler";

export type AuthPartner = "workos" | "ory" | "webflow" | "custom" | "password" | string;

export interface DomainAndHost {
    /**
     * x-fern-host (NOT the host of the request)
     */
    domain: string;

    /**
     * allowed destinations for redirects
     */
    allowedDestinations: string[];
}

interface AuthStateBase {
    /**
     * If true, the request is allowed to pass through
     * Otherwise, the request must be redirected to the authorizationUrl, or return a 401, or 403
     */
    ok: boolean;
}

// ok=false -> 401
interface NotLoggedIn extends AuthStateBase {
    /**
     * discriminant
     */
    authed: false;
    /**
     * The url to redirect to for authentication, containing the state parameter and redirect url
     */
    authorizationUrl: string | undefined;
    /**
     * The auth partner that is used for authentication (e.g. workos, custom)
     */
    partner: AuthPartner | undefined;
}

// ok=false -> 403
interface IsLoggedIn extends AuthStateBase {
    /**
     * discriminant
     */
    authed: true;
    /**
     * The user payload from the Fern JWT, and the AuthPartner are both guaranteed to be present if the user is logged in
     */
    user: FernUser;
    partner: AuthPartner | undefined;
}

export type AuthState = NotLoggedIn | IsLoggedIn;

/**
 * @internal visible for testing
 */
export async function getAuthStateInternal({
    fernToken,
    authConfig,
    previewAuthConfig,
    setFernToken,
    domain,
    host
}: {
    fernToken: string | undefined;
    authConfig?: AuthEdgeConfig;
    previewAuthConfig?: PreviewUrlAuth;
    setFernToken?: (token: string) => void;
    domain: string;
    host: string;
}): Promise<(pathname?: string) => AsyncOrSync<AuthState>> {
    // Password auth from edge config
    if (authConfig?.type === "password") {
        const jwtSecret = process.env.JWT_SECRET_KEY;

        if (!jwtSecret) {
            return () => ({
                authed: false,
                ok: false,
                authorizationUrl: undefined,
                partner: "password"
            });
        }

        const result = await safeVerifyPasswordAuth(fernToken, jwtSecret);

        if (result.valid) {
            return (pathname) => {
                return {
                    authed: true,
                    ok: true,
                    user: { roles: result.roles },
                    partner: "password"
                };
            };
        }

        // User is not authenticated - return authorization URL for password login
        return (pathname) => {
            return {
                authed: false,
                ok: false,
                authorizationUrl: getPasswordAuthorizationUrl(host, domain, pathname),
                partner: "password"
            };
        };
    }

    // if the auth type is neither sso nor basic_token_verification, allow the request to pass through
    if (!authConfig) {
        if (previewAuthConfig != null) {
            if (previewAuthConfig.type === "workos") {
                return (pathname) =>
                    handleWorkosAuth({
                        host,
                        domain,
                        fernToken,
                        organization: previewAuthConfig.org,
                        pathname,
                        setFernToken,
                        isPreview: true
                    });
            }
        }
        return () => ({
            authed: false,
            ok: true,
            authorizationUrl: undefined,
            partner: undefined
        });
    }

    // check if the request is allowed to pass through without authentication
    if (authConfig.type === "basic_token_verification" || authConfig.type === "oauth2") {
        const user = await safeVerifyFernJWTConfig(fernToken, authConfig);
        const partner = authConfig.type === "oauth2" ? authConfig.partner : "custom";
        if (user) {
            return () => ({ authed: true, ok: true, user, partner });
        } else {
            return (pathname) => ({
                authed: false,
                ok: false,
                authorizationUrl: getAuthorizationUrl(authConfig, host, domain, pathname),
                partner
            });
        }
    }

    // check if the user is logged in via WorkOS
    if (authConfig.type === "sso" && authConfig.partner === "workos") {
        return (pathname) =>
            handleWorkosAuth({
                host,
                domain,
                fernToken,
                organization: authConfig.organization,
                pathname,
                setFernToken,
                authorizationUrl: {
                    connection: authConfig.connection,
                    provider: authConfig.provider,
                    domainHint: authConfig.domainHint,
                    loginHint: authConfig.loginHint
                }
            });
    }

    return () => ({
        authed: false,
        ok: false,
        authorizationUrl: undefined,
        partner: undefined
    });
}

/**
 * Check if the user is logged in and the session is valid for the current docs.
 * - if the auth config is not present, assume that the site is available to the public
 * - if the auth config is present, check if the user is logged in and the session is valid for the current docs
 * - if the user is not logged in, check if the request is allowed to pass through without authentication; otherwise, redirect to the login page
 *
 * @param request - the request to check the headers / cookies
 * @param next - the function to call if the user is logged in and the session is valid for the current pathname
 */
export async function createGetAuthState(
    host: string,
    domain: string,
    fernToken: string | undefined,
    authConfig?: AuthEdgeConfig,
    orgMetadata?: {
        org: string;
        isPreview: boolean;
    },
    setFernToken?: (token: string) => void
): Promise<
    DomainAndHost & {
        getAuthState: (pathname?: string) => AsyncOrSync<AuthState>;
    }
> {
    if (isLocal() || isSelfHosted()) {
        return {
            domain: domain,
            allowedDestinations: [],
            getAuthState: (_pathname?: string) => ({
                authed: true,
                ok: true,
                user: {},
                partner: "custom"
            })
        };
    }

    authConfig ??= await getAuthEdgeConfig(domain);
    const previewAuthConfig = orgMetadata != null ? await getPreviewUrlAuthConfig(orgMetadata) : undefined;

    const getAuthState = await getAuthStateInternal({
        fernToken,
        authConfig,
        setFernToken,
        previewAuthConfig,
        domain,
        host
    });

    const allowedDestinations = getAllowedRedirectUrls(authConfig, previewAuthConfig);

    return {
        domain,
        allowedDestinations,
        getAuthState
    };
}

/**
 * Constructs the state parameter for OAuth flows, including the auth method ID
 * to support multi-auth configurations. The auth method ID is appended as a
 * query parameter `_fern_auth_method` to the return URL.
 */
function constructStateWithAuthMethod(
    host: string,
    domain: string,
    authConfig: AuthEdgeConfig,
    pathname?: string
): string {
    const baseUrl = `${withDefaultProtocol(
        decodeURIComponent(removeTrailingSlash(preferPreview(host, domain)))
    )}${pathname ?? ""}`;

    // Add auth method ID to enable correct config selection in callback
    const stateUrl = new URL(baseUrl);
    stateUrl.searchParams.set("_fern_auth_method", getAuthMethodId(authConfig));
    return stateUrl.toString();
}

export function getAuthorizationUrl(
    authConfig: AuthEdgeConfig,
    // TODO: we'll need to pass in the basepath here for any customers who are using a non-root basepath.
    host: string,
    domain: string,
    pathname?: string
): string | undefined {
    // Match the exact order of operations from handleWorkosAuth:
    // decodeURIComponent is applied AFTER removeTrailingSlash(preferPreview(host, domain))
    const state = constructStateWithAuthMethod(host, domain, authConfig, pathname);

    if (authConfig.type === "basic_token_verification") {
        const destination = new URL(authConfig.redirect);

        // note: `redirect` is allowed to override the default redirect uri, and the `return_to` param
        if (!destination.searchParams.has("redirect_uri")) {
            const redirectUri = `${withDefaultProtocol(
                decodeURIComponent(removeTrailingSlash(preferPreview(host, domain)))
            )}/api/fern-docs/auth/jwt/callback`;

            destination.searchParams.set("redirect_uri", redirectUri);
        }
        if (!destination.searchParams.has(getReturnToQueryParam(authConfig))) {
            destination.searchParams.set(getReturnToQueryParam(authConfig), state);
        }
        return destination.toString();
    } else if (authConfig.type === "sso" && authConfig.partner === "workos") {
        const redirectUri = `${withDefaultProtocol(
            decodeURIComponent(removeTrailingSlash(preferPreview(host, domain)))
        )}/api/fern-docs/auth/sso/callback`;

        return getWorkosSSOAuthorizationUrl({
            state,
            redirectUri,
            organization: authConfig.organization,
            connection: authConfig.connection,
            provider: authConfig.provider,
            domainHint: authConfig.domainHint,
            loginHint: authConfig.loginHint
        });
    } else if (authConfig.type === "oauth2") {
        if ("auth_endpoint" in authConfig) {
            return getOAuth2AuthorizationUrl(authConfig, {
                state,
                redirectUri: `${withDefaultProtocol(
                    decodeURIComponent(removeTrailingSlash(preferPreview(host, domain)))
                )}/api/fern-docs/oauth2/callback`
            });
        }

        // todo: deprecate
        if (authConfig.partner === "webflow") {
            return getWebflowAuthorizationUrl(authConfig, {
                state,
                redirectUri: `${withDefaultProtocol(
                    decodeURIComponent(removeTrailingSlash(preferPreview(host, domain)))
                )}/api/fern-docs/oauth/webflow/callback`
            });
        } else if (authConfig.partner === "ory") {
            return getOryAuthorizationUrl(authConfig, {
                state,
                redirectUri: `${withDefaultProtocol(
                    decodeURIComponent(removeTrailingSlash(preferPreview(host, domain)))
                )}/api/fern-docs/oauth/ory/callback`
            });
        }
    }

    return undefined;
}

export function getPasswordAuthorizationUrl(host: string, domain: string, pathname?: string): string {
    // Match the exact order of operations from handleWorkosAuth:
    // decodeURIComponent is applied AFTER removeTrailingSlash(preferPreview(host, domain))
    const baseUrl = withDefaultProtocol(decodeURIComponent(removeTrailingSlash(preferPreview(host, domain))));
    const loginUrl = new URL("/~login", baseUrl);

    // Include the return path so user can be redirected back after login
    loginUrl.searchParams.set("returnTo", `${baseUrl}${pathname ?? ""}`);

    return loginUrl.toString();
}

/**
 * Extracts the auth method ID from the state URL parameter.
 * Used in OAuth callbacks to determine which auth config was used to initiate the flow.
 */
export function extractAuthMethodFromState(stateUrl: string | null | undefined): string | undefined {
    if (!stateUrl) {
        return undefined;
    }
    try {
        const url = new URL(stateUrl);
        return url.searchParams.get("_fern_auth_method") ?? undefined;
    } catch {
        return undefined;
    }
}

/**
 * Removes the _fern_auth_method query parameter from a URL.
 * Used to clean the redirect URL before redirecting the user after OAuth callback.
 */
export function cleanAuthMethodFromUrl(url: URL): URL {
    url.searchParams.delete("_fern_auth_method");
    return url;
}
