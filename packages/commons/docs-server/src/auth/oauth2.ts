import type { OAuth2ClientCredentials } from "@fern-api/docs-auth";

export function getOAuth2AuthorizationUrl(
    authConfig: OAuth2ClientCredentials,
    {
        state,
        redirectUri
    }: {
        state?: string;
        redirectUri?: string;
    }
): string {
    const url = new URL(authConfig.auth_endpoint);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", authConfig.clientId);

    if (redirectUri != null) {
        url.searchParams.set("redirect_uri", redirectUri);
    }

    if (state != null) {
        url.searchParams.set("state", state);
    }

    if (authConfig.scope != null) {
        const scopeValue = Array.isArray(authConfig.scope) ? authConfig.scope.join(" ") : authConfig.scope;
        url.searchParams.set("scope", scopeValue);
    }

    url.search = url.search.replace(/%2B/g, "+");

    return url.toString();
}
